import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Banknote, LucideAngularModule, Plus } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { PricingApi } from '../../../core/api/commerce.api';
import type { DeviceCondition, PricingRule } from '../../../core/api/types';
import { AuthService } from '../../../core/auth/auth.service';
import { POLICY } from '../../../core/auth/roles';
import { DEVICE_CONDITIONS, DEVICE_CONDITION_LABELS, options } from '../../../core/enums/labels';
import { formatSle } from '../../../core/format/format';
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
} from '../../../shared/ui';

interface CellData {
  brand?: string;
  condition?: DeviceCondition;
  rule?: PricingRule;
}

/** PUT /pricing/matrix: creates or updates one cell (matched by brand + condition). */
@Component({
  selector: 'price-cell-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassSwitch, GlassButton],
  template: `
    <glass-modal
      [heading]="data.rule || data.brand ? 'Edit price' : 'Add a price'"
      description="Brand * is the fallback for any brand without its own row."
      (closed)="ref.close()"
    >
      <form id="pc-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-input
          label="Brand"
          formControlName="brand"
          placeholder="Samsung or *"
          [maxlength]="50"
          [required]="true"
        />
        <glass-select label="Condition" formControlName="condition" [options]="conditions" />
        <glass-input
          label="Price (SLE)"
          type="number"
          step="0.01"
          formControlName="priceSle"
          hint="0 to 99,999.99"
        />
        <glass-switch
          label="Active"
          formControlName="isActive"
          hint="Inactive prices aren't offered."
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
          form="pc-form"
          [loading]="action.busy()"
        >
          Save price
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class PriceCellDialog {
  protected readonly data = inject<CellData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<PricingRule>>(DialogRef);
  private readonly api = inject(PricingApi);
  protected readonly action = useAction();
  protected readonly conditions = options(DEVICE_CONDITIONS, DEVICE_CONDITION_LABELS);
  protected readonly form = new FormGroup({
    brand: new FormControl(this.data.rule?.brand ?? this.data.brand ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    condition: new FormControl<DeviceCondition>(
      this.data.rule?.condition ?? this.data.condition ?? 'Dead',
      { nonNullable: true },
    ),
    priceSle: new FormControl(this.data.rule ? String(this.data.rule.priceSle) : '', {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(99999.99)],
    }),
    isActive: new FormControl(this.data.rule?.isActive ?? true, { nonNullable: true }),
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const res = await this.action.run(
      this.api.upsert({
        brand: v.brand.trim(),
        condition: v.condition,
        priceSle: Number(v.priceSle),
        isActive: v.isActive,
      }),
      { form: this.form, success: 'Price saved.' },
    );
    if (res) this.ref.close(res);
  }
}

/** Pricing matrix (§8.9): brands as rows, the three conditions as columns. */
@Component({
  selector: 'ops-pricing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, PageHeader, GlassCard, GlassButton, Skeleton, EmptyState],
  template: `
    <page-header
      heading="Pricing"
      subheading="What the Hub pays sellers, by brand and condition. Purchases debit the Seed Fund at these prices."
    >
      @if (canEdit()) {
        <button page-actions glass-button variant="primary" type="button" (click)="edit({})">
          <lucide-icon [img]="i.Plus" [size]="16" aria-hidden="true" /> Add price
        </button>
      }
    </page-header>
    <glass-card padding="sm">
      <div [attr.aria-busy]="matrix.isLoading()">
        @if (matrix.isLoading() && !matrix.value()) {
          <skeleton [lines]="6" height="28px" />
        } @else if (matrix.error()) {
          <div class="form-error" role="alert">
            {{ errorText() }}
            <button glass-button size="sm" type="button" (click)="matrix.reload()">Retry</button>
          </div>
        } @else if (brands().length) {
          <div class="table-wrap">
            <table class="grid">
              <caption class="sr-only">
                Price per brand and condition, in SLE
              </caption>
              <thead>
                <tr>
                  <th scope="col">Brand</th>
                  @for (c of conditions; track c) {
                    <th scope="col" class="r">{{ conditionLabels[c] }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (b of brands(); track b) {
                  <tr>
                    <th scope="row">{{ b === '*' ? 'Any other brand (*)' : b }}</th>
                    @for (c of conditions; track c) {
                      <td class="r">
                        @if (cell(b, c); as rule) {
                          <button
                            type="button"
                            class="cell num"
                            [class.inactive]="!rule.isActive"
                            [disabled]="!canEdit()"
                            (click)="edit({ rule })"
                            [attr.aria-label]="
                              'Edit ' + b + ' ' + conditionLabels[c] + ': ' + money(rule.priceSle)
                            "
                          >
                            {{ money(rule.priceSle) }}
                            @if (!rule.isActive) {
                              <span class="tag">inactive</span>
                            }
                          </button>
                        } @else {
                          <button
                            type="button"
                            class="cell empty"
                            [disabled]="!canEdit()"
                            (click)="edit({ brand: b, condition: c })"
                            [attr.aria-label]="'Set price for ' + b + ' ' + conditionLabels[c]"
                          >
                            —
                          </button>
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <empty-state
            heading="No prices yet"
            message='Start with the "*" fallback row so every brand gets a quote.'
            [icon]="i.Banknote"
          />
        }
      </div>
    </glass-card>
  `,
  styles: `
    .grid {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--fs-sm);
    }
    .grid th,
    .grid td {
      padding: 6px 8px;
      border-bottom: 1px solid var(--field-border);
      text-align: left;
    }
    .grid thead th {
      font-size: var(--fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-3);
    }
    .grid tbody th {
      font-weight: 650;
      white-space: nowrap;
    }
    .r {
      text-align: right !important;
    }
    .cell {
      min-width: 120px;
      min-height: 40px;
      padding: 0 12px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: var(--text-1);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .cell:hover:not(:disabled) {
      background: var(--accent-soft);
    }
    .cell:disabled {
      cursor: default;
    }
    .cell.inactive {
      color: var(--text-3);
      text-decoration: line-through;
    }
    .cell.empty {
      color: var(--text-3);
    }
    .tag {
      margin-left: 6px;
      font-size: 10px;
      text-decoration: none;
      display: inline-block;
    }
  `,
})
export class OpsPricing {
  private readonly api = inject(PricingApi);
  private readonly modal = inject(ModalService);
  private readonly auth = inject(AuthService);
  protected readonly i = { Plus, Banknote };
  protected readonly conditions = DEVICE_CONDITIONS;
  protected readonly conditionLabels = DEVICE_CONDITION_LABELS;
  protected readonly canEdit = computed(() => this.auth.hasRole(...POLICY.Ops));
  protected readonly matrix = rxResource({ stream: () => this.api.matrix() });
  protected readonly errorText = computed(() => errorMessage(this.matrix.error()));
  /** Named brands alphabetically, the "*" fallback last. */
  protected readonly brands = computed(() => {
    const set = new Set((this.matrix.value() ?? []).map((r) => r.brand));
    const named = [...set].filter((b) => b !== '*').sort((a, b) => a.localeCompare(b));
    return set.has('*') ? [...named, '*'] : named;
  });

  protected cell(brand: string, c: DeviceCondition): PricingRule | undefined {
    return this.matrix.value()?.find((r) => r.brand === brand && r.condition === c);
  }
  protected edit(data: CellData): void {
    this.modal
      .open<PricingRule>(PriceCellDialog, data)
      .closed.subscribe((r) => r && this.matrix.reload());
  }
  protected money(v: number): string {
    return formatSle(v);
  }
}
