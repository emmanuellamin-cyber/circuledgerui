import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Calculator, LucideAngularModule, Smartphone } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { PublicApi } from '../../../core/api/public.api';
import type { DeviceCondition, PriceQuote } from '../../../core/api/types';
import { DEVICE_CONDITIONS, DEVICE_CONDITION_LABELS } from '../../../core/enums/labels';
import { formatSle } from '../../../core/format/format';
import { GlassButton, GlassInput } from '../../../shared/ui';

/**
 * Brand suggestions only. The brand is free text and the API falls back to the "any brand"
 * price (`matchedBrand: "*"`), so an unlisted brand still gets a quote.
 */
const BRAND_SUGGESTIONS = [
  'Samsung',
  'Tecno',
  'Infinix',
  'itel',
  'Nokia',
  'Apple',
  'Huawei',
  'Xiaomi',
];

/** "How much is my phone worth?" via `GET /public/pricing/quote` (§8.3). */
@Component({
  selector: 'price-quote-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassInput, GlassButton, LucideAngularModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="quote()" class="form" aria-label="Get a price quote">
      <glass-input
        label="Phone brand"
        placeholder="e.g. Samsung"
        formControlName="brand"
        autocomplete="off"
        [icon]="icons.Smartphone"
        [suggestions]="brands"
        [maxlength]="50"
      />
      <fieldset class="conditions">
        <legend>What's wrong with it?</legend>
        <div class="options">
          @for (c of conditions; track c) {
            <label class="option" [class.checked]="form.controls.condition.value === c">
              <input type="radio" formControlName="condition" [value]="c" name="condition" />
              <span>{{ conditionLabels[c] }}</span>
            </label>
          }
        </div>
      </fieldset>
      <button glass-button variant="primary" type="submit" [loading]="loading()" [block]="true">
        <lucide-icon [img]="icons.Calculator" [size]="17" aria-hidden="true" /> Get my price
      </button>
    </form>

    <div aria-live="polite" class="out">
      @if (error(); as e) {
        <p class="form-error" role="alert">{{ e }}</p>
      }
      @if (result(); as r) {
        <div class="result glass">
          @if (r.priceSle !== null) {
            <p class="label">Estimated offer</p>
            <p class="price num">{{ price(r) }}</p>
            <p class="muted small">
              For a {{ r.brand }} phone with {{ conditionLabels[r.condition].toLowerCase() }}.
              @if (r.matchedBrand === '*') {
                This is our general price for any brand.
              }
              The final price is confirmed when staff inspect the phone.
            </p>
          } @else {
            <p class="label">No price yet</p>
            <p class="muted small">
              We don't have a set price for this phone yet. Bring it to a drop-off point and staff
              will assess it.
            </p>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--s-4);
    }
    .form {
      display: grid;
      gap: var(--s-4);
    }
    .conditions {
      border: 0;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    legend {
      padding: 0;
      margin-bottom: 6px;
      font-size: var(--fs-sm);
      font-weight: 600;
    }
    .options {
      display: grid;
      gap: var(--s-2);
    }
    @media (min-width: 520px) {
      .options {
        grid-template-columns: repeat(3, 1fr);
      }
    }
    .option {
      position: relative;
      display: flex;
      align-items: center;
      min-height: 52px;
      padding: 10px 14px;
      border-radius: var(--r-md);
      background: var(--field-bg);
      box-shadow: inset 0 0 0 1px var(--field-border);
      font-size: var(--fs-sm);
      font-weight: 600;
      cursor: pointer;
      transition:
        box-shadow var(--dur-2),
        background var(--dur-2),
        transform var(--dur-2) var(--ease-spring);
    }
    .option:active {
      transform: scale(0.98);
    }
    .option.checked {
      background: var(--accent-soft);
      box-shadow: inset 0 0 0 2px var(--accent);
      color: var(--accent-ink);
    }
    .option input {
      position: absolute;
      opacity: 0;
      inset: 0;
      margin: 0;
      cursor: pointer;
    }
    .option:has(input:focus-visible) {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    .result {
      padding: var(--s-4) var(--s-5);
      border-radius: var(--r-lg);
      display: grid;
      gap: 4px;
    }
    .label {
      font-size: var(--fs-xs);
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent-ink);
    }
    .price {
      font-size: var(--fs-3xl);
      font-weight: 780;
      letter-spacing: -0.03em;
      line-height: 1.1;
    }
    .small {
      font-size: var(--fs-sm);
    }
  `,
})
export class PriceQuoteWidget {
  private readonly api = inject(PublicApi);
  protected readonly icons = { Calculator, Smartphone };
  protected readonly brands = BRAND_SUGGESTIONS;
  protected readonly conditions = DEVICE_CONDITIONS;
  protected readonly conditionLabels = DEVICE_CONDITION_LABELS;

  protected readonly form = new FormGroup({
    brand: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    condition: new FormControl<DeviceCondition>('BrokenScreen', { nonNullable: true }),
  });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<PriceQuote | null>(null);

  async quote(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { brand, condition } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    try {
      this.result.set(await firstValueFrom(this.api.quote(brand.trim(), condition)));
    } catch (e) {
      this.result.set(null);
      this.error.set(errorMessage(e, 'Could not get a price right now.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected price(r: PriceQuote): string {
    return formatSle(r.priceSle);
  }
}
