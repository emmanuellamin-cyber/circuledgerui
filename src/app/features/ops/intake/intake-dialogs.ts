import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DropOffApi } from '../../../core/api/admin.api';
import { IntakeApi } from '../../../core/api/intake.api';
import type {
  Device,
  DeviceCondition,
  FulfilmentMethod,
  IntakeChannel,
  IntakeRequest,
} from '../../../core/api/types';
import {
  CHANNEL_LABELS,
  DEVICE_CONDITIONS,
  DEVICE_CONDITION_LABELS,
  FULFILMENT_LABELS,
  FULFILMENT_METHODS,
  INTAKE_CHANNELS,
  options,
} from '../../../core/enums/labels';
import { useAction } from '../../../core/state/action';
import { GlassButton, GlassInput, GlassModal, GlassSelect, SelectOption } from '../../../shared/ui';
import { imeiValidator } from '../shared/ops-dialogs';

/** Sierra Leone bounds used by the API for coordinates (§8.4). */
export const SL_BOUNDS = { latMin: 6.8, latMax: 10.1, lngMin: -13.4, lngMax: -10.2 };

/** POST /intake-requests: a request on behalf of a seller (web/phone channel). */
@Component({
  selector: 'create-intake-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassButton],
  template: `
    <glass-modal
      heading="New sell request"
      description="The seller gets an SMS with the reference code."
      (closed)="ref.close()"
    >
      <form id="ci-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-input
          label="Seller phone"
          type="tel"
          inputmode="tel"
          formControlName="phone"
          placeholder="076123456"
          [required]="true"
        />
        <glass-select label="Channel" formControlName="channel" [options]="channels" />
        <glass-input label="Brand" formControlName="brand" [maxlength]="50" [required]="true" />
        <glass-input label="Model" formControlName="model" [optional]="true" />
        <glass-select label="Condition" formControlName="condition" [options]="conditions" />
        <glass-select label="Fulfilment" formControlName="fulfilmentMethod" [options]="methods" />
        @if (method() === 'DropOff') {
          <glass-select
            class="full"
            label="Drop-off point"
            formControlName="dropOffPointId"
            [options]="points()"
            placeholder="Choose a point"
          />
        } @else {
          <glass-input
            class="full"
            label="Pickup area or landmark"
            formControlName="pickupArea"
            [maxlength]="160"
            hint="Known towns (Njala, Bo, Towama, Kowama…) are geocoded automatically."
          />
          <glass-input
            label="Latitude"
            type="number"
            step="any"
            formControlName="pickupLatitude"
            [optional]="true"
          />
          <glass-input
            label="Longitude"
            type="number"
            step="any"
            formControlName="pickupLongitude"
            [optional]="true"
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
          form="ci-form"
          [loading]="action.busy()"
        >
          Create request
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class CreateIntakeDialog {
  protected readonly ref = inject<DialogRef<IntakeRequest>>(DialogRef);
  private readonly intake = inject(IntakeApi);
  private readonly dropOffs = inject(DropOffApi);
  protected readonly action = useAction();
  protected readonly conditions = options(DEVICE_CONDITIONS, DEVICE_CONDITION_LABELS);
  protected readonly methods = options(FULFILMENT_METHODS, FULFILMENT_LABELS);
  protected readonly channels = options(INTAKE_CHANNELS, CHANNEL_LABELS);
  private readonly pointsRes = rxResource({ stream: () => this.dropOffs.list() });
  protected readonly points = computed<SelectOption[]>(() =>
    (this.pointsRes.value() ?? []).map((p) => ({ value: p.id, label: p.name })),
  );

  protected readonly form = new FormGroup({
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    channel: new FormControl<IntakeChannel>('Web', { nonNullable: true }),
    brand: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    model: new FormControl('', { nonNullable: true }),
    condition: new FormControl<DeviceCondition>('BrokenScreen', { nonNullable: true }),
    fulfilmentMethod: new FormControl<FulfilmentMethod>('DropOff', { nonNullable: true }),
    dropOffPointId: new FormControl('', { nonNullable: true }),
    pickupArea: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(160)] }),
    pickupLatitude: new FormControl('', {
      nonNullable: true,
      validators: [Validators.min(SL_BOUNDS.latMin), Validators.max(SL_BOUNDS.latMax)],
    }),
    pickupLongitude: new FormControl('', {
      nonNullable: true,
      validators: [Validators.min(SL_BOUNDS.lngMin), Validators.max(SL_BOUNDS.lngMax)],
    }),
  });
  protected readonly method = toSignal(this.form.controls.fulfilmentMethod.valueChanges, {
    initialValue: 'DropOff' as FulfilmentMethod,
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (v.fulfilmentMethod === 'DropOff' && !v.dropOffPointId)
      this.form.controls.dropOffPointId.setErrors({ required: true });
    if (v.fulfilmentMethod === 'Pickup' && !v.pickupArea.trim())
      this.form.controls.pickupArea.setErrors({ required: true });
    if (
      v.fulfilmentMethod === 'Pickup' &&
      (v.pickupLatitude === '') !== (v.pickupLongitude === '')
    ) {
      this.action.error.set('Enter both latitude and longitude, or neither.');
      return;
    }
    if (this.form.invalid) return;
    const pickup = v.fulfilmentMethod === 'Pickup';
    const res = await this.action.run(
      this.intake.create({
        phone: v.phone.trim(),
        brand: v.brand.trim(),
        model: v.model.trim() || null,
        condition: v.condition,
        fulfilmentMethod: v.fulfilmentMethod,
        dropOffPointId: pickup ? null : v.dropOffPointId,
        pickupArea: pickup ? v.pickupArea.trim() : null,
        pickupLatitude: pickup && v.pickupLatitude !== '' ? Number(v.pickupLatitude) : null,
        pickupLongitude: pickup && v.pickupLongitude !== '' ? Number(v.pickupLongitude) : null,
        channel: v.channel,
      }),
      { form: this.form, success: 'Request created. The seller was sent the reference by SMS.' },
    );
    if (res) this.ref.close(res);
  }
}

/** POST /intake-requests/walk-in: request + device in one call. */
@Component({
  selector: 'walk-in-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassButton],
  template: `
    <glass-modal
      heading="Walk-in seller"
      description="Creates the intake request and the device in one step."
      (closed)="ref.close()"
    >
      <form id="wi-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-input
          label="Seller phone"
          type="tel"
          inputmode="tel"
          formControlName="phone"
          [required]="true"
        />
        <glass-select
          label="Received at"
          formControlName="dropOffPointId"
          [options]="points()"
          placeholder="Choose a point"
        />
        <glass-input label="Brand" formControlName="brand" [maxlength]="50" [required]="true" />
        <glass-input label="Model" formControlName="model" [optional]="true" />
        <glass-select label="Condition" formControlName="condition" [options]="conditions" />
        <glass-input
          label="IMEI"
          formControlName="imei"
          inputmode="numeric"
          [optional]="true"
          hint="Dial *#06#"
          [maxlength]="20"
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
          form="wi-form"
          [loading]="action.busy()"
        >
          Create device
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class WalkInDialog {
  protected readonly ref = inject<DialogRef<Device>>(DialogRef);
  private readonly intake = inject(IntakeApi);
  private readonly dropOffs = inject(DropOffApi);
  protected readonly action = useAction();
  protected readonly conditions = options(DEVICE_CONDITIONS, DEVICE_CONDITION_LABELS);
  private readonly pointsRes = rxResource({ stream: () => this.dropOffs.list() });
  protected readonly points = computed<SelectOption[]>(() =>
    (this.pointsRes.value() ?? []).map((p) => ({ value: p.id, label: p.name })),
  );

  protected readonly form = new FormGroup({
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    dropOffPointId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    brand: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    model: new FormControl('', { nonNullable: true }),
    condition: new FormControl<DeviceCondition>('WorkingFaulty', { nonNullable: true }),
    imei: new FormControl('', { nonNullable: true, validators: [imeiValidator] }),
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const device = await this.action.run(
      this.intake.walkIn({
        phone: v.phone.trim(),
        brand: v.brand.trim(),
        model: v.model.trim() || null,
        imei: v.imei.replace(/[\s-]/g, '') || null,
        condition: v.condition,
        dropOffPointId: v.dropOffPointId,
      }),
      {
        form: this.form,
        success: 'Walk-in recorded. Device created.',
        messages: {
          duplicate_imei:
            'Another active device already has this IMEI. Check for a duplicate or a stolen phone.',
        },
      },
    );
    if (device) this.ref.close(device);
  }
}
