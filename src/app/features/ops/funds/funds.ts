import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Coins, LucideAngularModule, Pencil, Plus } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { FundsApi } from '../../../core/api/commerce.api';
import type {
  FundTransaction,
  FundTransactionReason,
  FundType,
  ReinvestmentRule,
} from '../../../core/api/types';
import { AuthService } from '../../../core/auth/auth.service';
import { POLICY } from '../../../core/auth/roles';
import {
  FUND_LABELS,
  FUND_REASONS,
  FUND_TYPES,
  MANUAL_FUND_REASONS,
  options,
} from '../../../core/enums/labels';
import { formatDate, formatDateTime, formatSle } from '../../../core/format/format';
import { useAction } from '../../../core/state/action';
import { opt, urlQuery } from '../../../core/state/url-query';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassModal,
  GlassSelect,
  ModalService,
  PageHeader,
  Paginator,
  Skeleton,
  StatTile,
} from '../../../shared/ui';
import { withAll } from '../shared/ops-dialogs';

type ManualReason = (typeof MANUAL_FUND_REASONS)[number];

/** POST /funds/movements (Admin): grants credit, training expenses / adjustments debit. */
@Component({
  selector: 'fund-movement-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassButton],
  template: `
    <glass-modal
      heading="Record a fund movement"
      description="Grant = credit. Training expense and adjustment = debit."
      (closed)="ref.close()"
    >
      <form id="fm-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-select label="Fund" formControlName="fund" [options]="funds" />
        <glass-select label="Reason" formControlName="reason" [options]="reasons" />
        <glass-input
          label="Amount (SLE)"
          type="number"
          step="0.01"
          formControlName="amountSle"
          [required]="true"
        />
        <glass-input
          class="full"
          label="Description"
          formControlName="description"
          [maxlength]="300"
          placeholder="UNDP tranche 2"
          [required]="true"
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
          form="fm-form"
          [loading]="action.busy()"
        >
          Record
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class FundMovementDialog {
  protected readonly ref = inject<DialogRef<FundTransaction>>(DialogRef);
  private readonly api = inject(FundsApi);
  protected readonly action = useAction();
  protected readonly funds = options(FUND_TYPES, FUND_LABELS);
  protected readonly reasons = options(MANUAL_FUND_REASONS, {
    TrainingExpense: 'Training expense (debit)',
    Adjustment: 'Adjustment (debit)',
    Grant: 'Grant (credit)',
  });
  protected readonly form = new FormGroup({
    fund: new FormControl<FundType>('SeedFund', { nonNullable: true }),
    reason: new FormControl<ManualReason>('Grant', { nonNullable: true }),
    amountSle: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.01)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(300)],
    }),
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const res = await this.action.run(
      this.api.move({
        fund: v.fund,
        reason: v.reason,
        amountSle: Number(v.amountSle),
        description: v.description.trim(),
      }),
      { form: this.form, success: 'Movement recorded.' },
    );
    if (res) this.ref.close(res);
  }
}

/** PUT /reinvestment-rule (Admin) with a live preview on a SLE 1,000 sale. */
@Component({
  selector: 'rule-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassButton],
  template: `
    <glass-modal
      heading="Change the reinvestment rule"
      description="The current rule is kept in history."
      (closed)="ref.close()"
    >
      <form id="rule-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-input
          class="full"
          label="Rule name"
          formControlName="name"
          placeholder="2027 rule: 35%"
          [required]="true"
        />
        <glass-input
          label="Seed Fund %"
          type="number"
          step="0.01"
          formControlName="seedFundPercent"
        />
        <glass-input
          label="Training Fund %"
          type="number"
          step="0.01"
          formControlName="trainingFundPercent"
        />
        <p class="full banner" [class.info]="sumOk()" [class.bad]="!sumOk()" aria-live="polite">
          @if (sumOk()) {
            On a SLE 1,000 sale: {{ preview().seed }} Seed, {{ preview().training }} Training ({{
              preview().total
            }}% reinvested).
          } @else {
            The two percentages must add up to 100 or less.
          }
        </p>
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
          form="rule-form"
          [disabled]="!sumOk()"
          [loading]="action.busy()"
        >
          Replace rule
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class RuleDialog {
  protected readonly current = inject<ReinvestmentRule | null>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<ReinvestmentRule>>(DialogRef);
  private readonly api = inject(FundsApi);
  protected readonly action = useAction();
  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    seedFundPercent: new FormControl(String(this.current?.seedFundPercent ?? 20), {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(100)],
    }),
    trainingFundPercent: new FormControl(String(this.current?.trainingFundPercent ?? 10), {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(100)],
    }),
  });
  private readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly preview = computed(() => {
    const seed = Number(this.values().seedFundPercent) || 0;
    const training = Number(this.values().trainingFundPercent) || 0;
    return {
      seed: formatSle(seed * 10).replace('.00', ''),
      training: formatSle(training * 10).replace('.00', ''),
      total: seed + training,
      sum: seed + training,
    };
  });
  protected readonly sumOk = computed(() => this.preview().sum <= 100);

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.sumOk()) return;
    const v = this.form.getRawValue();
    const res = await this.action.run(
      this.api.updateRule({
        name: v.name.trim(),
        seedFundPercent: Number(v.seedFundPercent),
        trainingFundPercent: Number(v.trainingFundPercent),
      }),
      { form: this.form, success: 'Reinvestment rule replaced.' },
    );
    if (res) this.ref.close(res);
  }
}

/** Funds & reinvestment (§8.15). */
@Component({
  selector: 'ops-funds',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    GlassSelect,
    StatTile,
    Paginator,
    Skeleton,
    EmptyState,
  ],
  template: `
    <page-header
      heading="Funds & reinvestment"
      subheading="Seed Fund buys phones; part of every sale flows back into the funds."
    >
      @if (isAdmin()) {
        <button page-actions glass-button variant="primary" type="button" (click)="move()">
          <lucide-icon [img]="i.Plus" [size]="16" aria-hidden="true" /> Record movement
        </button>
      }
    </page-header>

    @if (data.value(); as d) {
      <div class="kpi-grid">
        @for (f of d.funds; track f.id) {
          <stat-tile
            [label]="f.name"
            [value]="money(f.balanceSle)"
            [caption]="fundLabels[f.type]"
            [icon]="i.Coins"
          />
        }
        <stat-tile label="Total grants" [value]="money(d.totalGrantsSle)" [subtle]="true" />
        <stat-tile label="Total purchases" [value]="money(d.totalPurchasesSle)" [subtle]="true" />
        <stat-tile label="Total reinvested" [value]="money(d.totalReinvestedSle)" [subtle]="true" />
      </div>
    } @else if (data.isLoading()) {
      <div class="kpi-grid">
        @for (n of [1, 2, 3]; track n) {
          <skeleton height="92px" radius="22px" />
        }
      </div>
    }

    <div class="split block">
      <glass-card heading="Transactions" padding="sm">
        <form
          class="filters row"
          (submit)="$event.preventDefault()"
          aria-label="Filter transactions"
        >
          <glass-select label="Fund" [options]="fundOptions" [formControl]="fund" />
          <glass-select label="Reason" [options]="reasonOptions" [formControl]="reason" />
        </form>
        <div [attr.aria-busy]="data.isLoading()">
          @if (data.error()) {
            <div class="form-error" role="alert">
              {{ errorText() }}
              <button glass-button size="sm" type="button" (click)="data.reload()">Retry</button>
            </div>
          } @else if (data.value()?.transactions?.items?.length) {
            <table class="data">
              <caption class="sr-only">
                Fund transactions
              </caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Fund</th>
                  <th scope="col">Reason</th>
                  <th scope="col" class="r">Amount</th>
                  <th scope="col" class="r">Balance after</th>
                </tr>
              </thead>
              <tbody>
                @for (t of data.value()!.transactions.items; track t.id) {
                  <tr>
                    <td data-label="When">
                      {{ when(t.occurredAt) }}
                      <div class="subtle tiny">{{ t.description }}</div>
                    </td>
                    <td data-label="Fund">{{ fundLabels[t.fundType] }}</td>
                    <td data-label="Reason">{{ t.reason }}</td>
                    <td
                      data-label="Amount"
                      class="r num"
                      [class.pos]="t.direction === 'Credit'"
                      [class.neg]="t.direction === 'Debit'"
                    >
                      <span class="sr-only">{{ t.direction }}</span
                      >{{ t.direction === 'Debit' ? '−' : '+' }}{{ money(t.amountSle) }}
                    </td>
                    <td data-label="Balance after" class="r num">{{ money(t.balanceAfterSle) }}</td>
                  </tr>
                }
              </tbody>
            </table>
            <glass-paginator
              [page]="data.value()!.transactions.page"
              [pageSize]="data.value()!.transactions.pageSize"
              [total]="data.value()!.transactions.totalCount"
              [pages]="data.value()!.transactions.totalPages"
              (pageChange)="q.setPage($event)"
            />
          } @else if (!data.isLoading()) {
            <empty-state
              heading="No transactions"
              message="Grants, purchases and reinvestments are listed here."
            />
          }
        </div>
      </glass-card>

      <glass-card heading="Reinvestment rule">
        @if (isAdmin()) {
          <button card-actions glass-button size="sm" type="button" (click)="editRule()">
            <lucide-icon [img]="i.Pencil" [size]="14" aria-hidden="true" /> Change
          </button>
        }
        @if (rule.value(); as r) {
          <p class="rule-name">{{ r.name }}</p>
          <div
            class="split-bar"
            role="img"
            [attr.aria-label]="
              r.seedFundPercent +
              '% Seed Fund, ' +
              r.trainingFundPercent +
              '% Training Fund, ' +
              (100 - r.totalPercent) +
              '% kept'
            "
          >
            <span class="seed" [style.flex]="r.seedFundPercent"></span>
            <span class="train" [style.flex]="r.trainingFundPercent"></span>
            <span class="rest" [style.flex]="100 - r.totalPercent"></span>
          </div>
          <ul class="legend">
            <li><i class="seed"></i>Seed Fund {{ r.seedFundPercent }}%</li>
            <li><i class="train"></i>Training Fund {{ r.trainingFundPercent }}%</li>
            <li><i class="rest"></i>Not reinvested {{ 100 - r.totalPercent }}%</li>
          </ul>
          <p class="subtle tiny">Since {{ date(r.effectiveFrom) }}</p>
        } @else if (rule.isLoading()) {
          <skeleton [lines]="3" />
        }
        @if (history.value()?.length) {
          <h3 class="hist-h">History</h3>
          <ul class="hist">
            @for (h of history.value(); track h.id) {
              <li [class.on]="h.isActive">
                <span>{{ h.name }}</span
                ><span class="subtle tiny">{{ date(h.effectiveFrom) }}</span>
              </li>
            }
          </ul>
        }
      </glass-card>
    </div>
  `,
  styles: `
    .block {
      margin-top: var(--s-4);
    }
    .filters {
      --row-gap: var(--s-2);
      margin-bottom: var(--s-3);
    }
    .filters > * {
      min-width: 160px;
      flex: 1;
    }
    .tiny {
      font-size: var(--fs-xs);
    }
    .rule-name {
      font-weight: 650;
      margin-bottom: var(--s-3);
    }
    .split-bar {
      display: flex;
      gap: 2px;
      height: 14px;
      border-radius: 8px;
      overflow: hidden;
    }
    .seed {
      background: var(--chart-1);
    }
    .train {
      background: var(--chart-2);
    }
    .rest {
      background: var(--neutral-bg);
    }
    .legend {
      list-style: none;
      margin: var(--s-3) 0;
      padding: 0;
      display: grid;
      gap: 4px;
      font-size: var(--fs-sm);
    }
    .legend i {
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 8px;
      border-radius: 3px;
    }
    .hist-h {
      margin: var(--s-4) 0 var(--s-2);
      font-size: var(--fs-sm);
    }
    .hist {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 4px;
      font-size: var(--fs-sm);
    }
    .hist li {
      display: flex;
      justify-content: space-between;
      gap: var(--s-2);
      padding: 6px 8px;
      border-radius: 8px;
    }
    .hist li.on {
      background: var(--accent-soft);
      font-weight: 600;
    }
  `,
})
export class OpsFunds {
  private readonly api = inject(FundsApi);
  private readonly modal = inject(ModalService);
  private readonly auth = inject(AuthService);
  protected readonly i = { Coins, Plus, Pencil };
  protected readonly fundLabels = FUND_LABELS;
  protected readonly fundOptions = withAll(options(FUND_TYPES, FUND_LABELS), 'Both funds');
  protected readonly reasonOptions = withAll(options(FUND_REASONS), 'Any reason');
  protected readonly isAdmin = computed(() => this.auth.hasRole(...POLICY.Admin));

  protected readonly q = urlQuery({ fund: '', reason: '' });
  protected readonly fund = new FormControl(this.q.value().fund, { nonNullable: true });
  protected readonly reason = new FormControl(this.q.value().reason, { nonNullable: true });
  protected readonly data = rxResource({
    params: () => ({ ...this.q.value(), page: this.q.page() }),
    stream: ({ params: p }) =>
      this.api.overview({
        fund: opt<FundType>(p.fund),
        reason: opt<FundTransactionReason>(p.reason),
        page: p.page,
        pageSize: 20,
      }),
  });
  protected readonly rule = rxResource({ stream: () => this.api.rule() });
  protected readonly history = rxResource({ stream: () => this.api.ruleHistory() });
  protected readonly errorText = computed(() => errorMessage(this.data.error()));

  constructor() {
    this.fund.valueChanges.pipe(takeUntilDestroyed()).subscribe((fund) => this.q.set({ fund }));
    this.reason.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((reason) => this.q.set({ reason }));
  }

  protected move(): void {
    this.modal
      .open<FundTransaction>(FundMovementDialog)
      .closed.subscribe((t) => t && this.data.reload());
  }
  protected editRule(): void {
    this.modal
      .open<ReinvestmentRule>(RuleDialog, this.rule.value() ?? null)
      .closed.subscribe((r) => {
        if (!r) return;
        this.rule.reload();
        this.history.reload();
      });
  }
  protected money(v: number): string {
    return formatSle(v);
  }
  protected when(v: string): string {
    return formatDateTime(v);
  }
  protected date(v: string): string {
    return formatDate(v);
  }
}
