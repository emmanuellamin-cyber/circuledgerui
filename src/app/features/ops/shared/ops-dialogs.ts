import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { DropOffApi } from '../../../core/api/admin.api';
import { FundsApi, PricingApi } from '../../../core/api/commerce.api';
import { DevicesApi } from '../../../core/api/devices.api';
import { IntakeApi } from '../../../core/api/intake.api';
import type {
  Device,
  DeviceCondition,
  IntakeRequest,
  PayoutMethod,
  PayoutStatus,
  Purchase,
} from '../../../core/api/types';
import {
  DEVICE_CONDITIONS,
  DEVICE_CONDITION_LABELS,
  PAYOUT_METHODS,
  PAYOUT_METHOD_LABELS,
  options,
} from '../../../core/enums/labels';
import { formatSle } from '../../../core/format/format';
import { useAction } from '../../../core/state/action';
import { GlassButton, GlassInput, GlassModal, GlassSelect, SelectOption } from '../../../shared/ui';

/** Prepends an "All" option for filter selects. */
export function withAll<T extends string>(opts: SelectOption<T>[], label = 'All'): SelectOption[] {
  return [{ value: '', label }, ...opts];
}

/** 15 digits + Luhn check digit (§8.5). Spaces and dashes ignored. Empty is allowed. */
export function imeiValidator(c: { value: string | null }): { imei: string } | null {
  const v = (c.value ?? '').replace(/[\s-]/g, '');
  if (!v) return null;
  if (!/^\d{15}$/.test(v)) return { imei: 'IMEI must be 15 digits.' };
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(v[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0 ? null : { imei: "IMEI check digit doesn't match. Re-check *#06#." };
}

// ---------------------------------------------------------------------------------------------

export interface ReasonDialogData {
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
  /** Runs with the typed reason; the dialog closes with its result on success. */
  submit: (reason: string) => Promise<unknown> | Observable<unknown>;
}

/** Cancel / reject / revoke with a required reason. */
@Component({
  selector: 'reason-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassButton],
  template: `
    <glass-modal [heading]="data.title" [description]="data.message" (closed)="ref.close()">
      <form id="reason-form" (ngSubmit)="submit()">
        <glass-input
          label="Reason"
          [rows]="3"
          [maxlength]="300"
          [formControl]="reason"
          [required]="true"
        />
        @if (action.error(); as e) {
          <p class="form-error" role="alert">{{ e }}</p>
        }
      </form>
      <ng-container modal-footer>
        <button glass-button variant="ghost" type="button" (click)="ref.close()">Back</button>
        <button
          glass-button
          type="submit"
          form="reason-form"
          [variant]="data.danger ? 'danger' : 'primary'"
          [loading]="action.busy()"
        >
          {{ data.confirmLabel }}
        </button>
      </ng-container>
    </glass-modal>
  `,
  styles: `
    .form-error {
      margin-top: var(--s-3);
    }
  `,
})
export class ReasonDialog {
  protected readonly data = inject<ReasonDialogData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly action = useAction();
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(300)],
  });

  async submit(): Promise<void> {
    this.reason.markAsTouched();
    if (this.reason.invalid) return;
    const work = this.data.submit(this.reason.value.trim());
    const res = await this.action.run(() => work);
    if (res !== undefined) this.ref.close(res);
  }
}

// ---------------------------------------------------------------------------------------------

/** POST /intake-requests/{id}/receive: the phone physically arrived (creates the Device). */
@Component({
  selector: 'receive-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassButton],
  template: `
    <glass-modal
      heading="Receive at hub"
      [description]="data.referenceCode + ' · ' + data.brand + (data.model ? ' ' + data.model : '')"
      (closed)="ref.close()"
    >
      <form id="receive-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-select
          class="full"
          label="Received at"
          formControlName="dropOffPointId"
          [options]="points()"
          placeholder="Choose a hub or kiosk"
        />
        <glass-input
          class="full"
          label="IMEI"
          formControlName="imei"
          inputmode="numeric"
          [optional]="true"
          hint="Dial *#06# on the phone. 15 digits."
          [maxlength]="20"
        />
        <glass-input
          label="Brand"
          formControlName="brand"
          [optional]="true"
          [hint]="'Seller said: ' + data.brand"
        />
        <glass-input label="Model" formControlName="model" [optional]="true" />
        <glass-select
          class="full"
          label="Assessed condition"
          formControlName="assessedCondition"
          [options]="conditions"
          [hint]="'Seller said: ' + conditionLabels[data.reportedCondition]"
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
          form="receive-form"
          [loading]="action.busy()"
        >
          Receive & create device
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class ReceiveDialog {
  protected readonly data = inject<IntakeRequest>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Device>>(DialogRef);
  private readonly intake = inject(IntakeApi);
  private readonly dropOffs = inject(DropOffApi);
  protected readonly action = useAction();
  protected readonly conditionLabels = DEVICE_CONDITION_LABELS;
  protected readonly conditions = withAll(
    options(DEVICE_CONDITIONS, DEVICE_CONDITION_LABELS),
    "Keep seller's value",
  );

  private readonly pointsRes = rxResource({ stream: () => this.dropOffs.list() });
  protected readonly points = computed<SelectOption[]>(() =>
    (this.pointsRes.value() ?? []).map((p) => ({ value: p.id, label: p.name })),
  );

  protected readonly form = new FormGroup({
    dropOffPointId: new FormControl(this.data.dropOffPointId ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    imei: new FormControl('', { nonNullable: true, validators: [imeiValidator] }),
    brand: new FormControl('', { nonNullable: true }),
    model: new FormControl(this.data.model ?? '', { nonNullable: true }),
    assessedCondition: new FormControl<DeviceCondition | ''>('', { nonNullable: true }),
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const device = await this.action.run(
      this.intake.receive(this.data.id, {
        dropOffPointId: v.dropOffPointId,
        imei: v.imei.replace(/[\s-]/g, '') || null,
        brand: v.brand.trim() || null,
        model: v.model.trim() || null,
        assessedCondition: v.assessedCondition || null,
      }),
      {
        form: this.form,
        success: 'Phone received. Device created.',
        messages: {
          duplicate_imei:
            'Another active device already has this IMEI. Check for a duplicate or a stolen phone.',
        },
      },
    );
    if (device) this.ref.close(device);
  }
}

// ---------------------------------------------------------------------------------------------

/**
 * POST /devices/{id}/purchase. Shows the pricing-matrix quote and the Seed Fund balance first
 * (§8.8 UX tip). The price is debited from the Seed Fund.
 */
@Component({
  selector: 'purchase-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassButton],
  template: `
    <glass-modal
      heading="Buy this phone"
      [description]="data.trackingId + ' · ' + data.brand + (data.model ? ' ' + data.model : '')"
      (closed)="ref.close()"
    >
      <div class="summary">
        <div>
          <span class="k">Matrix price</span>
          <strong class="num">{{ quoteText() }}</strong>
          <span class="s">{{ conditionLabels[data.condition] }}</span>
        </div>
        <div>
          <span class="k">Seed Fund balance</span>
          <strong class="num">{{ balanceText() }}</strong>
          @if (after() !== null) {
            <span class="s" [class.neg]="after()! < 0">After purchase: {{ afterText() }}</span>
          }
        </div>
      </div>
      <form id="purchase-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-select label="Payout method" formControlName="payoutMethod" [options]="methods" />
        <glass-input
          label="Agreed price (SLE)"
          type="number"
          inputmode="decimal"
          formControlName="agreedPriceSle"
          [optional]="true"
          hint="Leave empty to use the matrix price."
          [min]="0.01"
          step="0.01"
        />
        <glass-input
          class="full"
          label="Payout reference"
          formControlName="payoutReference"
          [optional]="true"
          [maxlength]="100"
          hint="Mobile-money transaction ID, if already paid."
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
          form="purchase-form"
          [loading]="action.busy()"
        >
          Buy for {{ priceText() }}
        </button>
      </ng-container>
    </glass-modal>
  `,
  styles: `
    .summary {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--s-3);
      margin-bottom: var(--s-4);
    }
    .summary > div {
      display: grid;
      gap: 2px;
      padding: var(--s-3);
      border-radius: var(--r-md);
      background: var(--glass-fill-nested);
    }
    .k {
      font-size: var(--fs-xs);
      color: var(--text-3);
      font-weight: 600;
    }
    strong {
      font-size: var(--fs-xl);
    }
    .s {
      font-size: var(--fs-xs);
      color: var(--text-2);
    }
  `,
})
export class PurchaseDialog {
  protected readonly data = inject<Device>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Purchase>>(DialogRef);
  private readonly devices = inject(DevicesApi);
  private readonly pricing = inject(PricingApi);
  private readonly funds = inject(FundsApi);
  protected readonly action = useAction();
  protected readonly conditionLabels = DEVICE_CONDITION_LABELS;
  protected readonly methods = options(PAYOUT_METHODS, PAYOUT_METHOD_LABELS);

  private readonly quote = rxResource({
    stream: () => this.pricing.quote(this.data.brand, this.data.condition),
  });
  private readonly fundsRes = rxResource({ stream: () => this.funds.overview({ pageSize: 1 }) });

  protected readonly form = new FormGroup({
    payoutMethod: new FormControl<PayoutMethod>('OrangeMoney', { nonNullable: true }),
    agreedPriceSle: new FormControl('', {
      nonNullable: true,
      validators: [Validators.min(0.01), Validators.max(99999.99)],
    }),
    payoutReference: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
  });
  private readonly agreed = toSignal(this.form.controls.agreedPriceSle.valueChanges, {
    initialValue: '',
  });

  private readonly balance = computed(
    () => this.fundsRes.value()?.funds.find((f) => f.type === 'SeedFund')?.balanceSle ?? null,
  );
  private readonly price = computed(() => {
    const a = Number(this.agreed());
    return this.agreed() !== '' && a > 0 ? a : (this.quote.value()?.priceSle ?? null);
  });
  protected readonly after = computed(() => {
    const b = this.balance();
    const p = this.price();
    return b === null || p === null ? null : b - p;
  });
  protected readonly quoteText = computed(() =>
    this.quote.isLoading()
      ? '…'
      : this.quote.value()?.priceSle === null
        ? 'No price'
        : formatSle(this.quote.value()?.priceSle),
  );
  protected readonly balanceText = computed(() =>
    this.fundsRes.isLoading() ? '…' : formatSle(this.balance()),
  );
  protected readonly afterText = computed(() => formatSle(this.after()));
  protected readonly priceText = computed(() =>
    this.price() === null ? 'agreed price' : formatSle(this.price()),
  );

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const purchase = await this.action.run(
      this.devices.purchase(this.data.id, {
        payoutMethod: v.payoutMethod,
        agreedPriceSle: v.agreedPriceSle === '' ? null : Number(v.agreedPriceSle),
        payoutReference: v.payoutReference.trim() || null,
      }),
      {
        form: this.form,
        success: 'Phone purchased. The seller gets an SMS.',
        messages: {
          already_purchased: 'This device was already bought. Refresh the page.',
          no_price: 'No price in the matrix for this brand and condition. Enter an agreed price.',
        },
      },
    );
    if (purchase) this.ref.close(purchase);
  }
}

// ---------------------------------------------------------------------------------------------

/** PUT /devices/{id}/purchase/payout. Reference required when Paid; Paid is final. */
@Component({
  selector: 'payout-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassButton],
  template: `
    <glass-modal
      heading="Record payout"
      [description]="data.trackingId + ' · ' + paid()"
      (closed)="ref.close()"
    >
      <form id="payout-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-select label="Result" formControlName="status" [options]="statuses" />
        <glass-input
          label="Payout reference"
          formControlName="payoutReference"
          [maxlength]="100"
          placeholder="OM-TXN-445566"
          hint="Required when paid."
        />
        <p class="banner info full">Once marked Paid, the payout can't be changed.</p>
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
          form="payout-form"
          [loading]="action.busy()"
        >
          Save
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class PayoutDialog {
  protected readonly data = inject<Device>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Purchase>>(DialogRef);
  private readonly devices = inject(DevicesApi);
  protected readonly action = useAction();
  protected readonly statuses: SelectOption<PayoutStatus>[] = [
    { value: 'Paid', label: 'Paid' },
    { value: 'Failed', label: 'Failed' },
  ];
  protected readonly paid = signal(
    `${formatSle(this.data.purchase?.paidPriceSle)} by ${this.data.purchase ? PAYOUT_METHOD_LABELS[this.data.purchase.payoutMethod] : '—'}`,
  );

  protected readonly form = new FormGroup({
    status: new FormControl<PayoutStatus>('Paid', { nonNullable: true }),
    payoutReference: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
  });

  async submit(): Promise<void> {
    const v = this.form.getRawValue();
    if (v.status === 'Paid' && !v.payoutReference.trim()) {
      this.form.controls.payoutReference.setErrors({ required: true });
      this.form.controls.payoutReference.markAsTouched();
      return;
    }
    const res = await this.action.run(
      this.devices.updatePayout(this.data.id, {
        status: v.status,
        payoutReference: v.payoutReference.trim() || null,
      }),
      {
        form: this.form,
        success: 'Payout recorded.',
        messages: { payout_completed: 'This payout is already marked Paid.' },
      },
    );
    if (res) this.ref.close(res);
  }
}
