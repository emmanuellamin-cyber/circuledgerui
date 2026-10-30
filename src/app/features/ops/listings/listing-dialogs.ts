import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ComponentsApi, ListingsApi } from '../../../core/api/commerce.api';
import { DevicesApi } from '../../../core/api/devices.api';
import type { Grade, Listing, ListingItemType } from '../../../core/api/types';
import { GRADES, LISTING_ITEM_TYPES, humanize, options } from '../../../core/enums/labels';
import { useAction } from '../../../core/state/action';
import { GlassButton, GlassInput, GlassModal, GlassSelect, SelectOption } from '../../../shared/ui';

export interface CreateListingData {
  itemType?: ListingItemType;
  deviceId?: string;
  componentId?: string;
}

const listingValidators = {
  title: [Validators.required, Validators.maxLength(150)],
  description: [Validators.maxLength(2000)],
  priceSle: [Validators.required, Validators.min(0.01), Validators.max(999999.99)],
  warrantyDays: [Validators.required, Validators.min(0), Validators.max(365)],
};

/** POST /listings: a refurbished device (Refurbishing + valid certificate) or an InStock part. */
@Component({
  selector: 'create-listing-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassButton],
  template: `
    <glass-modal
      heading="New listing"
      description="Created as a Draft. Add and verify a photo before publishing."
      (closed)="ref.close()"
    >
      <form id="cl-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-select class="full" label="Item type" formControlName="itemType" [options]="types" />
        @if (type() === 'RefurbishedDevice') {
          <glass-select
            class="full"
            label="Device (Refurbishing)"
            formControlName="deviceId"
            [options]="deviceOptions()"
            placeholder="Choose a device"
            hint="Brand, model and certificate are filled in from the device."
          />
        } @else {
          <glass-select
            class="full"
            label="Component (in stock)"
            formControlName="componentId"
            [options]="componentOptions()"
            placeholder="Choose a component"
          />
        }
        <glass-input
          class="full"
          label="Title"
          formControlName="title"
          [maxlength]="150"
          placeholder="Samsung Galaxy A14 - refurbished, new screen"
          [required]="true"
        />
        <glass-input
          class="full"
          label="Description"
          formControlName="description"
          [rows]="3"
          [maxlength]="2000"
          [optional]="true"
        />
        <glass-input
          label="Price (SLE)"
          type="number"
          step="0.01"
          formControlName="priceSle"
          [required]="true"
        />
        <glass-select label="Condition grade" formControlName="condition" [options]="grades" />
        <glass-input
          label="Warranty (days)"
          type="number"
          formControlName="warrantyDays"
          hint="0–365"
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
          form="cl-form"
          [loading]="action.busy()"
        >
          Create draft
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class CreateListingDialog {
  protected readonly data = inject<CreateListingData | null>(DIALOG_DATA, { optional: true }) ?? {};
  protected readonly ref = inject<DialogRef<Listing>>(DialogRef);
  private readonly listings = inject(ListingsApi);
  private readonly devices = inject(DevicesApi);
  private readonly components = inject(ComponentsApi);
  protected readonly action = useAction();
  protected readonly types = options(LISTING_ITEM_TYPES, {
    RefurbishedDevice: 'Refurbished phone',
    Component: 'Part / component',
  });
  protected readonly grades = options(GRADES);

  private readonly deviceRes = rxResource({
    stream: () => this.devices.list({ status: 'Refurbishing', pageSize: 100 }),
  });
  private readonly componentRes = rxResource({
    stream: () => this.components.list({ status: 'InStock', pageSize: 100 }),
  });
  protected readonly deviceOptions = computed<SelectOption[]>(() =>
    (this.deviceRes.value()?.items ?? []).map((d) => ({
      value: d.id,
      label: `${d.trackingId} · ${d.brand} ${d.model ?? ''}`.trim(),
    })),
  );
  protected readonly componentOptions = computed<SelectOption[]>(() =>
    (this.componentRes.value()?.items ?? []).map((c) => ({
      value: c.id,
      label: `${c.componentCode} · ${c.brand} ${humanize(c.type)} (${c.grade})`,
    })),
  );

  protected readonly form = new FormGroup({
    itemType: new FormControl<ListingItemType>(this.data.itemType ?? 'RefurbishedDevice', {
      nonNullable: true,
    }),
    deviceId: new FormControl(this.data.deviceId ?? '', { nonNullable: true }),
    componentId: new FormControl(this.data.componentId ?? '', { nonNullable: true }),
    title: new FormControl('', { nonNullable: true, validators: listingValidators.title }),
    description: new FormControl('', {
      nonNullable: true,
      validators: listingValidators.description,
    }),
    priceSle: new FormControl('', { nonNullable: true, validators: listingValidators.priceSle }),
    condition: new FormControl<Grade>('B', { nonNullable: true }),
    warrantyDays: new FormControl('90', {
      nonNullable: true,
      validators: listingValidators.warrantyDays,
    }),
  });
  protected readonly type = toSignal(this.form.controls.itemType.valueChanges, {
    initialValue: this.form.controls.itemType.value,
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const device = v.itemType === 'RefurbishedDevice';
    if (device && !v.deviceId) this.form.controls.deviceId.setErrors({ required: true });
    if (!device && !v.componentId) this.form.controls.componentId.setErrors({ required: true });
    if (this.form.invalid) return;
    const listing = await this.action.run(
      this.listings.create({
        itemType: v.itemType,
        deviceId: device ? v.deviceId : null,
        componentId: device ? null : v.componentId,
        title: v.title.trim(),
        description: v.description.trim() || null,
        priceSle: Number(v.priceSle),
        condition: v.condition,
        warrantyDays: Number(v.warrantyDays),
      }),
      {
        form: this.form,
        success: 'Draft listing created.',
        messages: { already_listed: 'This item already has an active listing.' },
      },
    );
    if (listing) this.ref.close(listing);
  }
}

/** PUT /listings/{id}. Allowed in Draft, Published and Withdrawn. */
@Component({
  selector: 'edit-listing-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassButton],
  template: `
    <glass-modal heading="Edit listing" [description]="data.listingCode" (closed)="ref.close()">
      <form id="el-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-input
          class="full"
          label="Title"
          formControlName="title"
          [maxlength]="150"
          [required]="true"
        />
        <glass-input
          class="full"
          label="Description"
          formControlName="description"
          [rows]="4"
          [maxlength]="2000"
          [optional]="true"
        />
        <glass-input label="Price (SLE)" type="number" step="0.01" formControlName="priceSle" />
        <glass-select label="Condition grade" formControlName="condition" [options]="grades" />
        <glass-input label="Warranty (days)" type="number" formControlName="warrantyDays" />
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
          form="el-form"
          [loading]="action.busy()"
        >
          Save
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class EditListingDialog {
  protected readonly data = inject<Listing>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Listing>>(DialogRef);
  private readonly listings = inject(ListingsApi);
  protected readonly action = useAction();
  protected readonly grades = options(GRADES);
  protected readonly form = new FormGroup({
    title: new FormControl(this.data.title, {
      nonNullable: true,
      validators: listingValidators.title,
    }),
    description: new FormControl(this.data.description ?? '', {
      nonNullable: true,
      validators: listingValidators.description,
    }),
    priceSle: new FormControl(String(this.data.priceSle), {
      nonNullable: true,
      validators: listingValidators.priceSle,
    }),
    condition: new FormControl<Grade>(this.data.condition, { nonNullable: true }),
    warrantyDays: new FormControl(String(this.data.warrantyDays), {
      nonNullable: true,
      validators: listingValidators.warrantyDays,
    }),
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const res = await this.action.run(
      this.listings.update(this.data.id, {
        title: v.title.trim(),
        description: v.description.trim() || null,
        priceSle: Number(v.priceSle),
        condition: v.condition,
        warrantyDays: Number(v.warrantyDays),
      }),
      { form: this.form, success: 'Listing updated.' },
    );
    if (res) this.ref.close(res);
  }
}
