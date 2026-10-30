import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CircleCheck, LucideAngularModule, Phone, Plus, Smartphone } from 'lucide-angular';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api/api.service';
import { errorMessage } from '../../core/api/api-error';
import { IntakeApi } from '../../core/api/intake.api';
import { PublicApi } from '../../core/api/public.api';
import type { DeviceCondition, FulfilmentMethod, IntakeRequest } from '../../core/api/types';
import { AuthService } from '../../core/auth/auth.service';
import {
  DEVICE_CONDITIONS,
  DEVICE_CONDITION_LABELS,
  FULFILMENT_LABELS,
  FULFILMENT_METHODS,
  options,
} from '../../core/enums/labels';
import { formatDateTime, formatSle, relativeTime } from '../../core/format/format';
import { useAction } from '../../core/state/action';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassModal,
  GlassSelect,
  ModalService,
  SelectOption,
  Skeleton,
  StatusPill,
} from '../../shared/ui';

/** POST /intake-requests from the citizen portal, with their own phone (§9 E). */
@Component({
  selector: 'citizen-sell-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassButton],
  template: `
    <glass-modal
      heading="Sell a phone"
      description="You'll get a reference code by SMS."
      (closed)="ref.close()"
    >
      <form id="cs-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-input
          class="full"
          label="Your phone number"
          type="tel"
          inputmode="tel"
          formControlName="phone"
          hint="Use the number you registered with so the request shows here."
          [required]="true"
        />
        <glass-input
          label="Brand"
          formControlName="brand"
          [maxlength]="50"
          placeholder="Samsung"
          [required]="true"
        />
        <glass-input label="Model" formControlName="model" [optional]="true" />
        <glass-select label="What's wrong?" formControlName="condition" [options]="conditions" />
        <glass-select label="How?" formControlName="fulfilmentMethod" [options]="methods" />
        @if (method() === 'DropOff') {
          <glass-select
            class="full"
            label="Drop-off point"
            formControlName="dropOffPointId"
            [options]="points()"
            placeholder="Choose where you'll bring it"
          />
        } @else {
          <glass-input
            class="full"
            label="Your area or landmark"
            formControlName="pickupArea"
            [maxlength]="160"
            placeholder="Towama layout, near the mosque"
            hint="An agent will call you before coming."
          />
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
          form="cs-form"
          [loading]="action.busy()"
        >
          Send request
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class CitizenSellDialog {
  protected readonly ref = inject<DialogRef<IntakeRequest>>(DialogRef);
  private readonly intake = inject(IntakeApi);
  private readonly publicApi = inject(PublicApi);
  protected readonly action = useAction();
  protected readonly conditions = options(DEVICE_CONDITIONS, DEVICE_CONDITION_LABELS);
  protected readonly methods = options(FULFILMENT_METHODS, {
    DropOff: 'I will drop it off',
    Pickup: 'Pick it up from me',
  });
  private readonly pointsRes = rxResource({ stream: () => this.publicApi.dropOffPoints() });
  protected readonly points = computed<SelectOption[]>(() =>
    (this.pointsRes.value() ?? []).map((p) => ({
      value: p.id,
      label: `${p.name} · ${p.openingHours}`,
    })),
  );
  protected readonly form = new FormGroup({
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    brand: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    model: new FormControl('', { nonNullable: true }),
    condition: new FormControl<DeviceCondition>('BrokenScreen', { nonNullable: true }),
    fulfilmentMethod: new FormControl<FulfilmentMethod>('DropOff', { nonNullable: true }),
    dropOffPointId: new FormControl('', { nonNullable: true }),
    pickupArea: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(160)] }),
  });
  protected readonly method = toSignal(this.form.controls.fulfilmentMethod.valueChanges, {
    initialValue: 'DropOff' as FulfilmentMethod,
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const pickup = v.fulfilmentMethod === 'Pickup';
    if (!pickup && !v.dropOffPointId)
      this.form.controls.dropOffPointId.setErrors({ required: true });
    if (pickup && !v.pickupArea.trim()) this.form.controls.pickupArea.setErrors({ required: true });
    if (this.form.invalid) return;
    const res = await this.action.run(
      this.intake.create({
        phone: v.phone.trim(),
        brand: v.brand.trim(),
        model: v.model.trim() || null,
        condition: v.condition,
        fulfilmentMethod: v.fulfilmentMethod,
        dropOffPointId: pickup ? null : v.dropOffPointId,
        pickupArea: pickup ? v.pickupArea.trim() : null,
        channel: 'Web',
      }),
      { form: this.form },
    );
    if (res) this.ref.close(res);
  }
}

/** Citizen portal (§9 E): my sell requests (matched by the phone I registered with). */
@Component({
  selector: 'citizen-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAngularModule,
    GlassCard,
    GlassButton,
    StatusPill,
    Skeleton,
    EmptyState,
  ],
  template: `
    <section class="container section">
      <div class="head">
        <div>
          <p class="eyebrow">My phones</p>
          <h1>{{ greeting() }}</h1>
          <p class="muted">
            Requests you made online or by dialling {{ ussd }} from your registered number.
          </p>
        </div>
        <button glass-button variant="primary" size="lg" type="button" (click)="sell()">
          <lucide-icon [img]="i.Plus" [size]="18" aria-hidden="true" /> Sell a phone
        </button>
      </div>

      @if (list.isLoading() && !list.value()) {
        <skeleton [lines]="3" height="100px" />
      } @else if (list.error()) {
        <div class="form-error" role="alert">
          {{ errorText() }}
          <button glass-button size="sm" type="button" (click)="list.reload()">Retry</button>
        </div>
      } @else if (list.value()?.length) {
        <ul class="items">
          @for (r of list.value(); track r.id) {
            <li>
              <glass-card>
                <div class="top">
                  <div>
                    <strong class="mono ref">{{ r.referenceCode }}</strong>
                    <p>
                      {{ r.brand }}{{ r.model ? ' ' + r.model : '' }} ·
                      {{ conditionLabels[r.reportedCondition] }}
                    </p>
                    <p class="subtle small">
                      {{ fulfilmentLabels[r.fulfilmentMethod] }}:
                      {{
                        r.fulfilmentMethod === 'DropOff'
                          ? (r.dropOffPointName ?? '—')
                          : (r.pickupArea ?? '—')
                      }}
                      · {{ ago(r.createdAt) }}
                    </p>
                  </div>
                  <status-pill [status]="r.status" />
                </div>
                <ol class="track" aria-label="Progress">
                  @for (s of stages(r); track s.label) {
                    <li [class.done]="s.done">
                      <lucide-icon [img]="i.CircleCheck" [size]="15" aria-hidden="true" />
                      {{ s.label }}
                      @if (s.at) {
                        <span class="subtle"> · {{ when(s.at) }}</span>
                      }
                    </li>
                  }
                </ol>
                @if (r.estimatedOfferSle !== null) {
                  <p class="offer">
                    Estimated offer <strong class="num">{{ money(r.estimatedOfferSle) }}</strong>
                  </p>
                }
                @if (r.closedReason) {
                  <p class="banner info">{{ r.closedReason }}</p>
                }
              </glass-card>
            </li>
          }
        </ul>
      } @else {
        <glass-card>
          <empty-state
            heading="No sell requests yet"
            [message]="'Sell here, or dial ' + ussd + ' from your registered number.'"
            [icon]="i.Smartphone"
          >
            <button glass-button size="sm" variant="primary" type="button" (click)="sell()">
              Sell a phone
            </button>
            <a glass-button size="sm" routerLink="/" fragment="sell">See prices</a>
          </empty-state>
        </glass-card>
      }
      <p class="subtle small help">
        <lucide-icon [img]="i.Phone" [size]="14" aria-hidden="true" /> Check any request by SMS:
        <span class="mono">STATUS &lt;reference&gt;</span>
      </p>
    </section>
  `,
  styles: `
    .head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-end;
      gap: var(--s-4);
      margin-bottom: var(--s-5);
    }
    .head h1 {
      font-size: var(--fs-3xl);
    }
    .items {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--s-3);
    }
    .top {
      display: flex;
      justify-content: space-between;
      gap: var(--s-3);
    }
    .ref {
      font-size: var(--fs-lg);
    }
    .small {
      font-size: var(--fs-sm);
    }
    .track {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
      margin: var(--s-3) 0 0;
      padding: 0;
      list-style: none;
      font-size: var(--fs-xs);
      color: var(--text-3);
    }
    .track li {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .track li.done {
      color: var(--success);
      font-weight: 600;
    }
    .offer {
      margin-top: var(--s-3);
      font-size: var(--fs-sm);
    }
    .banner {
      margin-top: var(--s-3);
    }
    .help {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: var(--s-5);
    }
  `,
})
export class CitizenHome {
  private readonly api = inject(ApiService);
  private readonly modal = inject(ModalService);
  private readonly auth = inject(AuthService);
  protected readonly i = { Plus, Smartphone, CircleCheck, Phone };
  protected readonly ussd = environment.ussdServiceCode;
  protected readonly conditionLabels = DEVICE_CONDITION_LABELS;
  protected readonly fulfilmentLabels = FULFILMENT_LABELS;
  /** GET /users/me/intake-requests (plain array). */
  protected readonly list = rxResource({
    stream: () => this.api.get<IntakeRequest[]>('/users/me/intake-requests'),
  });
  protected readonly errorText = computed(() => errorMessage(this.list.error()));
  protected readonly greeting = computed(
    () => `Hello${this.auth.user() ? ', ' + this.auth.user()!.fullName.split(' ')[0] : ''}`,
  );

  protected stages(r: IntakeRequest): { label: string; done: boolean; at: string | null }[] {
    const order = ['Pending', 'Scheduled', 'Collected', 'Received'];
    const idx = order.indexOf(r.status);
    const closed = r.status === 'Cancelled' || r.status === 'Rejected';
    const base: { label: string; done: boolean; at: string | null }[] = [
      { label: 'Requested', done: true, at: r.createdAt },
    ];
    if (r.fulfilmentMethod === 'Pickup') {
      base.push({ label: 'Pickup scheduled', done: !closed && idx >= 1, at: r.scheduledAt });
      base.push({ label: 'Collected', done: !closed && idx >= 2, at: r.collectedAt });
    }
    base.push({ label: 'Received at hub', done: !closed && idx >= 3, at: r.receivedAt });
    return base;
  }
  protected sell(): void {
    this.modal
      .open<IntakeRequest>(CitizenSellDialog)
      .closed.subscribe((r) => r && this.list.reload());
  }
  protected money(v: number): string {
    return formatSle(v);
  }
  protected ago(v: string): string {
    return relativeTime(v);
  }
  protected when(v: string | null): string {
    return formatDateTime(v);
  }
}
