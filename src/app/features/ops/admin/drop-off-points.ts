import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, MapPin, Pencil, Plus, Trash2 } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { DropOffApi } from '../../../core/api/admin.api';
import type { DropOffPoint, DropOffPointType } from '../../../core/api/types';
import { AuthService } from '../../../core/auth/auth.service';
import { POLICY } from '../../../core/auth/roles';
import { DROP_OFF_TYPES, DROP_OFF_TYPE_LABELS, options } from '../../../core/enums/labels';
import { useAction } from '../../../core/state/action';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassModal,
  GlassSelect,
  GlassSwitch,
  ModalService,
  PageHeader,
  Skeleton,
  StatusPill,
  ToastService,
} from '../../../shared/ui';
import { SL_BOUNDS } from '../intake/intake-dialogs';

/** POST / PUT /drop-off-points (send the full object). Lat/lng bounds catch swapped values. */
@Component({
  selector: 'drop-off-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassSwitch, GlassButton],
  template: `
    <glass-modal
      [heading]="data ? 'Edit ' + data.name : 'New drop-off point'"
      description="Display order sets the order in the USSD menu."
      (closed)="ref.close()"
    >
      <form id="dp-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-input
          label="Name"
          formControlName="name"
          [maxlength]="120"
          placeholder="Kiosk Bo/Kowama"
          [required]="true"
        />
        <glass-select label="Type" formControlName="type" [options]="types" />
        <glass-input
          label="Latitude"
          type="number"
          step="any"
          formControlName="latitude"
          hint="6.8 to 10.1"
          [required]="true"
        />
        <glass-input
          label="Longitude"
          type="number"
          step="any"
          formControlName="longitude"
          hint="−13.4 to −10.2"
          [required]="true"
        />
        <glass-input
          class="full"
          label="Landmark"
          formControlName="landmark"
          [optional]="true"
          placeholder="Kowama, Bo"
        />
        <glass-input
          label="Opening hours"
          formControlName="openingHours"
          [maxlength]="120"
          placeholder="Mon-Sun 09:00-19:00"
          [required]="true"
        />
        <glass-input label="Display order" type="number" formControlName="displayOrder" />
        <div class="full">
          <glass-switch
            label="Active"
            formControlName="isActive"
            hint="Inactive points disappear from USSD and the public map."
          />
        </div>
        @if (swapped()) {
          <p class="banner warn full">
            These look swapped: in Sierra Leone latitude is about 7–10 and longitude about −13 to
            −10.
          </p>
        }
        @if (action.error(); as e) {
          <p class="form-error full" role="alert">{{ e }}</p>
        }
      </form>
      <ng-container modal-footer>
        <button glass-button variant="ghost" type="button" (click)="ref.close()">Cancel</button>
        <button
          glass-button
          variant="primary"
          type="submit"
          form="dp-form"
          [loading]="action.busy()"
        >
          Save
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class DropOffDialog {
  protected readonly data = inject<DropOffPoint | null>(DIALOG_DATA, { optional: true });
  protected readonly ref = inject<DialogRef<DropOffPoint>>(DialogRef);
  private readonly api = inject(DropOffApi);
  protected readonly action = useAction();
  protected readonly types = options(DROP_OFF_TYPES, DROP_OFF_TYPE_LABELS);
  protected readonly form = new FormGroup({
    name: new FormControl(this.data?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    type: new FormControl<DropOffPointType>(this.data?.type ?? 'Kiosk', { nonNullable: true }),
    latitude: new FormControl(this.data ? String(this.data.latitude) : '', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(SL_BOUNDS.latMin),
        Validators.max(SL_BOUNDS.latMax),
      ],
    }),
    longitude: new FormControl(this.data ? String(this.data.longitude) : '', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(SL_BOUNDS.lngMin),
        Validators.max(SL_BOUNDS.lngMax),
      ],
    }),
    landmark: new FormControl(this.data?.landmark ?? '', { nonNullable: true }),
    openingHours: new FormControl(this.data?.openingHours ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    displayOrder: new FormControl(String(this.data?.displayOrder ?? 10), { nonNullable: true }),
    isActive: new FormControl(this.data?.isActive ?? true, { nonNullable: true }),
  });
  private readonly v = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly swapped = computed(() => {
    const lat = Number(this.v().latitude);
    const lng = Number(this.v().longitude);
    return lat < -10 && lat > -13.5 && lng > 6.5 && lng < 10.5;
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const body = {
      name: v.name.trim(),
      type: v.type,
      latitude: Number(v.latitude),
      longitude: Number(v.longitude),
      landmark: v.landmark.trim() || null,
      openingHours: v.openingHours.trim(),
      isActive: v.isActive,
      displayOrder: Number(v.displayOrder) || 0,
    };
    const res = await this.action.run(
      this.data ? this.api.update(this.data.id, body) : this.api.create(body),
      {
        form: this.form,
        success: this.data ? 'Drop-off point updated.' : 'Drop-off point created.',
      },
    );
    if (res) this.ref.close(res);
  }
}

/** Drop-off points (§8.4). */
@Component({
  selector: 'ops-drop-off-points',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    GlassSwitch,
    StatusPill,
    Skeleton,
    EmptyState,
  ],
  template: `
    <page-header
      heading="Drop-off points"
      subheading="Hubs, kiosks and Solar Makits where sellers bring phones."
    >
      @if (canEdit()) {
        <button page-actions glass-button variant="primary" type="button" (click)="edit(null)">
          <lucide-icon [img]="i.Plus" [size]="16" aria-hidden="true" /> New point
        </button>
      }
    </page-header>
    <div class="filter-bar glass">
      <glass-switch label="Show inactive" [formControl]="includeInactive" />
    </div>
    <glass-card padding="sm">
      @if (list.isLoading() && !list.value()) {
        <skeleton [lines]="5" height="22px" />
      } @else if (list.error()) {
        <div class="form-error" role="alert">
          {{ errorText() }}
          <button glass-button size="sm" type="button" (click)="list.reload()">Retry</button>
        </div>
      } @else if (list.value()?.length) {
        <table class="data">
          <caption class="sr-only">
            Drop-off points in display order
          </caption>
          <thead>
            <tr>
              <th scope="col" class="r">#</th>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">Hours</th>
              <th scope="col">Coordinates</th>
              <th scope="col">Status</th>
              <th scope="col"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (p of list.value(); track p.id) {
              <tr>
                <td data-label="#" class="r num">{{ p.displayOrder }}</td>
                <td data-label="Name">
                  {{ p.name }}
                  <div class="subtle tiny">{{ p.landmark }}</div>
                </td>
                <td data-label="Type">{{ typeLabels[p.type] }}</td>
                <td data-label="Hours">{{ p.openingHours }}</td>
                <td data-label="Coordinates" class="num">
                  {{ p.latitude.toFixed(4) }}, {{ p.longitude.toFixed(4) }}
                </td>
                <td data-label="Status">
                  <status-pill
                    [status]="p.isActive ? 'Active' : 'Inactive'"
                    [tone]="p.isActive ? 'success' : 'neutral'"
                  />
                </td>
                <td class="r">
                  @if (canEdit()) {
                    <div class="row end">
                      <button
                        glass-button
                        size="sm"
                        type="button"
                        [iconOnly]="true"
                        [attr.aria-label]="'Edit ' + p.name"
                        (click)="edit(p)"
                      >
                        <lucide-icon [img]="i.Pencil" [size]="14" />
                      </button>
                      <button
                        glass-button
                        size="sm"
                        variant="ghost"
                        type="button"
                        [iconOnly]="true"
                        [attr.aria-label]="'Delete ' + p.name"
                        (click)="remove(p)"
                      >
                        <lucide-icon [img]="i.Trash2" [size]="14" />
                      </button>
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <empty-state
          heading="No drop-off points"
          message="Add the first hub so sellers can drop phones off."
          [icon]="i.MapPin"
        />
      }
    </glass-card>
  `,
  styles: `
    .tiny {
      font-size: var(--fs-xs);
    }
    .end {
      justify-content: flex-end;
      --row-gap: var(--s-1);
    }
  `,
})
export class OpsDropOffPoints {
  private readonly api = inject(DropOffApi);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  protected readonly i = { Plus, Pencil, Trash2, MapPin };
  protected readonly typeLabels = DROP_OFF_TYPE_LABELS;
  protected readonly canEdit = computed(() => this.auth.hasRole(...POLICY.Ops));
  protected readonly includeInactive = new FormControl(false, { nonNullable: true });
  private readonly inactive = toSignal(this.includeInactive.valueChanges, { initialValue: false });
  protected readonly list = rxResource({
    params: () => this.inactive(),
    stream: ({ params: all }) => this.api.list(all),
  });
  protected readonly errorText = computed(() => errorMessage(this.list.error()));

  protected edit(p: DropOffPoint | null): void {
    this.modal
      .open<DropOffPoint>(DropOffDialog, p)
      .closed.subscribe((r) => r && this.list.reload());
  }
  protected async remove(p: DropOffPoint): Promise<void> {
    const ok = await this.modal.confirm({
      title: `Delete ${p.name}?`,
      message:
        'It is hidden everywhere (soft delete). To close it temporarily, edit it and switch off "Active" instead.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.api.remove(p.id).subscribe({
      next: () => {
        this.toast.success('Drop-off point deleted.');
        this.list.reload();
      },
      error: (e: unknown) => this.toast.error(e),
    });
  }
}
