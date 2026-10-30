import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BadgeCheck, LucideAngularModule, PackageCheck, ReceiptText, X } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { OrdersApi } from '../../../core/api/commerce.api';
import type { Order, OrderStatus } from '../../../core/api/types';
import { ORDER_STATUSES, options } from '../../../core/enums/labels';
import { formatDateTime, formatSle, relativeTime } from '../../../core/format/format';
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
  StatusPill,
  ToastService,
} from '../../../shared/ui';
import { ReasonDialog, ReasonDialogData, withAll } from '../shared/ops-dialogs';

/** POST /orders/{id}/pay: confirms payment, marks items Sold, credits the funds (§8.14). */
@Component({
  selector: 'pay-order-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassButton],
  template: `
    <glass-modal
      heading="Confirm payment"
      [description]="data.orderNumber + ' · ' + total"
      (closed)="ref.close()"
    >
      <form id="pay-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-select label="Payment method" formControlName="paymentMethod" [options]="methods" />
        <glass-input
          label="Payment reference"
          formControlName="paymentReference"
          [maxlength]="100"
          [optional]="true"
          placeholder="OM-778812"
        />
        <p class="banner info full">
          Check the payment statement first. This marks the items sold and reinvests part of the
          sale in one step.
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
          form="pay-form"
          [loading]="action.busy()"
        >
          Confirm payment
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class PayOrderDialog {
  protected readonly data = inject<Order>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Order>>(DialogRef);
  private readonly orders = inject(OrdersApi);
  protected readonly action = useAction();
  protected readonly total = formatSle(this.data.totalSle);
  /** Free text up to 40 chars on the API; these are the common ones. */
  protected readonly methods = [
    { value: 'OrangeMoney', label: 'Orange Money' },
    { value: 'Afrimoney', label: 'Afrimoney' },
    { value: 'Cash', label: 'Cash' },
    { value: 'BankTransfer', label: 'Bank transfer' },
  ];
  protected readonly form = new FormGroup({
    paymentMethod: new FormControl('OrangeMoney', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(40)],
    }),
    paymentReference: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const res = await this.action.run(
      this.orders.pay(this.data.id, {
        paymentMethod: v.paymentMethod,
        paymentReference: v.paymentReference.trim() || null,
      }),
      { form: this.form },
    );
    if (res) this.ref.close(res);
  }
}

/** Orders (§8.14). Default view: awaiting payment confirmation (Pending). */
@Component({
  selector: 'ops-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    GlassSelect,
    StatusPill,
    Paginator,
    Skeleton,
    EmptyState,
  ],
  template: `
    <page-header
      heading="Orders"
      subheading="Confirm payments, hand over items, and see what each sale reinvested."
    />
    <form
      class="filter-bar glass"
      role="search"
      aria-label="Filter orders"
      (submit)="$event.preventDefault()"
    >
      <glass-select label="Status" [options]="statusOptions" [formControl]="status" />
    </form>
    <div class="split">
      <glass-card padding="sm">
        <div [attr.aria-busy]="list.isLoading()">
          @if (list.isLoading() && !list.value()) {
            <skeleton [lines]="8" height="22px" />
          } @else if (list.error()) {
            <div class="form-error" role="alert">
              {{ errorText() }}
              <button glass-button size="sm" type="button" (click)="list.reload()">Retry</button>
            </div>
          } @else if (list.value()?.items?.length) {
            <table class="data">
              <caption class="sr-only">
                Orders
              </caption>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Items</th>
                  <th scope="col" class="r">Total</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (o of list.value()!.items; track o.id) {
                  <tr
                    class="clickable"
                    [class.sel]="q.value().selected === o.id"
                    (click)="select(o)"
                  >
                    <td data-label="Order">
                      <button
                        type="button"
                        class="link-btn mono"
                        (click)="select(o); $event.stopPropagation()"
                      >
                        {{ o.orderNumber }}
                      </button>
                      <div class="subtle tiny">{{ ago(o.createdAt) }}</div>
                    </td>
                    <td data-label="Items">{{ o.items.length }}</td>
                    <td data-label="Total" class="r num">{{ money(o.totalSle) }}</td>
                    <td data-label="Payment">{{ o.paymentMethod ?? '—' }}</td>
                    <td data-label="Status"><status-pill [status]="o.status" /></td>
                  </tr>
                }
              </tbody>
            </table>
            <glass-paginator
              [page]="list.value()!.page"
              [pageSize]="list.value()!.pageSize"
              [total]="list.value()!.totalCount"
              [pages]="list.value()!.totalPages"
              (pageChange)="q.setPage($event)"
            />
          } @else {
            <empty-state
              [heading]="
                q.value().status === 'Pending' ? 'No orders awaiting payment' : 'No orders'
              "
              message="Orders appear when buyers check out in the marketplace."
              [icon]="i.ReceiptText"
            />
          }
        </div>
      </glass-card>

      @if (q.value().selected) {
        <glass-card variant="strong" class="detail" [attr.aria-busy]="selected.isLoading()">
          @if (selected.value(); as o) {
            <div class="row head">
              <div>
                <p class="eyebrow">Order</p>
                <h2 class="mono">{{ o.orderNumber }}</h2>
              </div>
              <button type="button" class="x" aria-label="Close order" (click)="close()">
                <lucide-icon [img]="i.X" [size]="18" />
              </button>
            </div>
            <status-pill [status]="o.status" />
            <ul class="items">
              @for (it of o.items; track it.listingId) {
                <li>
                  <span
                    >{{ it.title }}<span class="subtle tiny mono"> · {{ it.listingCode }}</span>
                    @if (it.certificateNumber) {
                      <br /><span class="tiny cert"
                        ><lucide-icon [img]="i.BadgeCheck" [size]="12" aria-hidden="true" />
                        {{ it.certificateNumber }}</span
                      >
                    }
                  </span>
                  <span class="num">{{ money(it.priceSle) }}</span>
                </li>
              }
              <li class="total">
                <span>Total</span><span class="num">{{ money(o.totalSle) }}</span>
              </li>
            </ul>
            <dl class="dl">
              <div>
                <dt>Created</dt>
                <dd>{{ when(o.createdAt) }}</dd>
              </div>
              @if (o.paidAt) {
                <div>
                  <dt>Paid</dt>
                  <dd>{{ when(o.paidAt) }}</dd>
                </div>
              }
              @if (o.paymentReference) {
                <div>
                  <dt>Reference</dt>
                  <dd class="mono">{{ o.paymentReference }}</dd>
                </div>
              }
              @if (o.fulfilledAt) {
                <div>
                  <dt>Fulfilled</dt>
                  <dd>{{ when(o.fulfilledAt) }}</dd>
                </div>
              }
              @if (o.cancelledAt) {
                <div>
                  <dt>Cancelled</dt>
                  <dd>{{ when(o.cancelledAt) }}</dd>
                </div>
                <div class="wide">
                  <dt>Reason</dt>
                  <dd>{{ o.cancellationReason }}</dd>
                </div>
              }
            </dl>
            @if (o.reinvestment; as r) {
              <p class="banner ok">
                {{ money(r.totalReinvestedSle) }} reinvested: {{ money(r.seedFundSle) }} Seed Fund,
                {{ money(r.trainingFundSle) }} Training Fund.
              </p>
            }
            @if (action.error(); as e) {
              <p class="form-error" role="alert">{{ e }}</p>
            }
            <div class="row">
              @if (o.status === 'Pending') {
                <button glass-button variant="primary" type="button" (click)="pay(o)">
                  Confirm payment
                </button>
                <button glass-button variant="danger" type="button" (click)="cancel(o)">
                  Cancel order
                </button>
              }
              @if (o.status === 'Paid') {
                <button
                  glass-button
                  variant="primary"
                  type="button"
                  [loading]="action.busy()"
                  (click)="fulfil(o)"
                >
                  <lucide-icon [img]="i.PackageCheck" [size]="16" aria-hidden="true" /> Mark
                  fulfilled
                </button>
              }
            </div>
          } @else {
            <skeleton [lines]="6" />
          }
        </glass-card>
      }
    </div>
  `,
  styles: `
    .tiny {
      font-size: var(--fs-xs);
    }
    tr.sel {
      background: var(--accent-soft);
    }
    .detail {
      position: sticky;
      top: 150px;
      display: grid;
      gap: var(--s-3);
    }
    .head {
      justify-content: space-between;
      align-items: flex-start;
    }
    .head h2 {
      font-size: var(--fs-xl);
    }
    .x {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 50%;
      background: var(--neutral-bg);
      color: var(--text-1);
      cursor: pointer;
    }
    .items {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
      font-size: var(--fs-sm);
    }
    .items li {
      display: flex;
      justify-content: space-between;
      gap: var(--s-2);
      padding: 8px 0;
      border-bottom: 1px solid var(--field-border);
    }
    .items .total {
      font-weight: 700;
      border-bottom: 0;
    }
    .cert {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: var(--success);
    }
  `,
})
export class OpsOrders {
  private readonly orders = inject(OrdersApi);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);
  protected readonly i = { ReceiptText, X, PackageCheck, BadgeCheck };
  protected readonly action = useAction();
  protected readonly statusOptions = withAll(options(ORDER_STATUSES), 'Any status');

  protected readonly q = urlQuery({ status: 'Pending', selected: '' });
  protected readonly status = new FormControl(this.q.value().status, { nonNullable: true });
  protected readonly list = rxResource({
    params: () => ({ status: this.q.value().status, page: this.q.page() }),
    stream: ({ params: p }) =>
      this.orders.list({ status: opt<OrderStatus>(p.status), page: p.page, pageSize: 20 }),
  });
  protected readonly selected = rxResource({
    params: () => this.q.value().selected || undefined,
    stream: ({ params: id }) => this.orders.get(id),
  });
  protected readonly errorText = computed(() => errorMessage(this.list.error()));

  constructor() {
    this.status.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.q.set({ status }));
  }

  protected select(o: Order): void {
    this.action.error.set(null);
    this.q.set({ selected: o.id }, { keepPage: true });
  }
  protected close(): void {
    this.q.set({ selected: '' }, { keepPage: true });
  }
  protected pay(o: Order): void {
    this.modal.open<Order>(PayOrderDialog, o).closed.subscribe((res) => {
      if (!res) return;
      const r = res.reinvestment;
      this.toast.success(
        r
          ? `${formatSle(r.totalReinvestedSle)} reinvested: ${formatSle(r.seedFundSle)} Seed Fund, ${formatSle(r.trainingFundSle)} Training.`
          : 'Payment confirmed.',
        'Order paid',
      );
      this.refresh();
    });
  }
  protected async fulfil(o: Order): Promise<void> {
    const res = await this.action.run(this.orders.fulfil(o.id), { success: 'Order fulfilled.' });
    if (res) this.refresh();
  }
  protected cancel(o: Order): void {
    const data: ReasonDialogData = {
      title: `Cancel ${o.orderNumber}?`,
      message: 'The listings go back on sale.',
      confirmLabel: 'Cancel order',
      danger: true,
      submit: (reason) => this.orders.cancel(o.id, reason),
    };
    this.modal.open<Order>(ReasonDialog, data).closed.subscribe((res) => {
      if (res) {
        this.toast.success('Order cancelled.');
        this.refresh();
      }
    });
  }
  protected money(v: number): string {
    return formatSle(v);
  }
  protected when(v: string | null): string {
    return formatDateTime(v);
  }
  protected ago(v: string): string {
    return relativeTime(v);
  }
  private refresh(): void {
    this.list.reload();
    this.selected.reload();
  }
}
