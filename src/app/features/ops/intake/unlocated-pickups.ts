import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Crosshair, LucideAngularModule, MapPinCheck } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { IntakeApi } from '../../../core/api/intake.api';
import type { IntakeRequest } from '../../../core/api/types';
import { DEVICE_CONDITION_LABELS } from '../../../core/enums/labels';
import { relativeTime } from '../../../core/format/format';
import { useAction } from '../../../core/state/action';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassModal,
  ModalService,
  PageHeader,
  Skeleton,
} from '../../../shared/ui';
import { SL_BOUNDS } from './intake-dialogs';

/** PUT /intake-requests/{id}/pickup-location with the device GPS or typed coordinates. */
@Component({
  selector: 'set-location-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, LucideAngularModule, GlassModal, GlassInput, GlassButton],
  template: `
    <glass-modal
      heading="Set pickup location"
      [description]="data.referenceCode + ' · ' + (data.pickupArea ?? 'no area given')"
      (closed)="ref.close()"
    >
      <form id="loc-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <div class="full row">
          <button glass-button type="button" (click)="locate()" [loading]="locating()">
            <lucide-icon [img]="Crosshair" [size]="16" aria-hidden="true" /> Use my location
          </button>
          @if (geoError()) {
            <span class="subtle small" role="status">{{ geoError() }}</span>
          }
        </div>
        <glass-input
          label="Latitude"
          type="number"
          step="any"
          formControlName="latitude"
          [required]="true"
          hint="6.8 to 10.1"
        />
        <glass-input
          label="Longitude"
          type="number"
          step="any"
          formControlName="longitude"
          [required]="true"
          hint="−13.4 to −10.2"
        />
        <glass-input
          class="full"
          label="Pickup area"
          formControlName="pickupArea"
          [optional]="true"
          [maxlength]="160"
        />
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
          form="loc-form"
          [loading]="action.busy()"
        >
          Save location
        </button>
      </ng-container>
    </glass-modal>
  `,
  styles: `
    .small {
      font-size: var(--fs-xs);
    }
  `,
})
export class SetLocationDialog {
  protected readonly data = inject<IntakeRequest>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<IntakeRequest>>(DialogRef);
  private readonly intake = inject(IntakeApi);
  protected readonly action = useAction();
  protected readonly Crosshair = Crosshair;
  protected readonly locating = signal(false);
  protected readonly geoError = signal<string | null>(null);
  protected readonly form = new FormGroup({
    latitude: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(SL_BOUNDS.latMin),
        Validators.max(SL_BOUNDS.latMax),
      ],
    }),
    longitude: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(SL_BOUNDS.lngMin),
        Validators.max(SL_BOUNDS.lngMax),
      ],
    }),
    pickupArea: new FormControl(this.data.pickupArea ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(160)],
    }),
  });

  protected locate(): void {
    if (!navigator.geolocation) {
      this.geoError.set('Location is not available in this browser.');
      return;
    }
    this.locating.set(true);
    this.geoError.set(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locating.set(false);
        this.form.patchValue({
          latitude: pos.coords.latitude.toFixed(5),
          longitude: pos.coords.longitude.toFixed(5),
        });
        this.form.markAllAsTouched();
      },
      (err) => {
        this.locating.set(false);
        this.geoError.set(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied.'
            : 'Could not get your location.',
        );
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const res = await this.action.run(
      this.intake.setPickupLocation(this.data.id, {
        latitude: Number(v.latitude),
        longitude: Number(v.longitude),
        pickupArea: v.pickupArea.trim() || null,
      }),
      { form: this.form, success: 'Location saved. It will be included in the next batch.' },
    );
    if (res) this.ref.close(res);
  }
}

/** Pending pickups with no coordinates (skipped by batching). Filtered client-side (§9 A). */
@Component({
  selector: 'unlocated-pickups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, PageHeader, GlassCard, GlassButton, Skeleton, EmptyState],
  template: `
    <page-header
      heading="Unlocated pickups"
      subheading="Pending pickup requests without coordinates are skipped when batches are generated."
    />
    <glass-card padding="sm" [attr.aria-busy]="list.isLoading()">
      @if (list.isLoading() && !list.value()) {
        <skeleton [lines]="6" height="22px" />
      } @else if (list.error()) {
        <div class="form-error" role="alert">
          {{ errorText() }}
          <button glass-button size="sm" type="button" (click)="list.reload()">Retry</button>
        </div>
      } @else if (rows().length) {
        <table class="data">
          <caption class="sr-only">
            Pending pickups without coordinates
          </caption>
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">Phone</th>
              <th scope="col">Area given</th>
              <th scope="col">Created</th>
              <th scope="col"><span class="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.id) {
              <tr>
                <td data-label="Reference" class="mono">{{ r.referenceCode }}</td>
                <td data-label="Phone">
                  {{ r.brand }} · {{ conditionLabels[r.reportedCondition] }}
                </td>
                <td data-label="Area given">{{ r.pickupArea ?? '—' }}</td>
                <td data-label="Created">{{ ago(r.createdAt) }}</td>
                <td class="r">
                  <button
                    glass-button
                    size="sm"
                    variant="primary"
                    type="button"
                    (click)="setLocation(r)"
                  >
                    Set location
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (truncated()) {
          <p class="subtle small">Showing pickups from the newest 100 pending requests.</p>
        }
      } @else {
        <empty-state
          heading="Every pending pickup has a location"
          message="Batches can include all of them."
          [icon]="MapPinCheck"
        />
      }
    </glass-card>
  `,
  styles: `
    .small {
      font-size: var(--fs-xs);
      margin-top: var(--s-2);
    }
  `,
})
export class UnlocatedPickups {
  private readonly intake = inject(IntakeApi);
  private readonly modal = inject(ModalService);
  protected readonly MapPinCheck = MapPinCheck;
  protected readonly conditionLabels = DEVICE_CONDITION_LABELS;
  protected readonly list = rxResource({
    stream: () =>
      this.intake.list({ status: 'Pending', fulfilmentMethod: 'Pickup', pageSize: 100 }),
  });
  protected readonly rows = computed(() =>
    (this.list.value()?.items ?? []).filter((r) => r.pickupLatitude === null),
  );
  protected readonly truncated = computed(() => (this.list.value()?.totalPages ?? 1) > 1);
  protected readonly errorText = computed(() => errorMessage(this.list.error()));

  protected setLocation(r: IntakeRequest): void {
    this.modal
      .open<IntakeRequest>(SetLocationDialog, r)
      .closed.subscribe((res) => res && this.list.reload());
  }
  protected ago(v: string): string {
    return relativeTime(v);
  }
}
