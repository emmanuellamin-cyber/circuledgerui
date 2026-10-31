import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ArrowLeft, BadgeCheck, LucideAngularModule, ReceiptText } from 'lucide-angular';
import { errorMessage } from '../../core/api/api-error';
import { OrdersApi } from '../../core/api/commerce.api';
import type { Order } from '../../core/api/types';
import { formatDateTime, formatSle, relativeTime } from '../../core/format/format';
import { urlQuery } from '../../core/state/url-query';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  ModalService,
  Paginator,
  Skeleton,
  StatusPill,
  ToastService,
} from '../../shared/ui';
import { ORDER_CANCEL, ReasonDialog, ReasonDialogData } from '../ops/shared/ops-dialogs';

/** My orders (§9 D): GET /orders/mine. */
@Component({
  selector: 'my-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAngularModule,
    GlassCard,
    GlassButton,
    StatusPill,
    Paginator,
    Skeleton,
    EmptyState,
  ],
  template: `
    <h1 class="h1">My orders</h1>
    @if (list.isLoading() && !list.value()) {
      <skeleton [lines]="4" height="64px" />
    } @else if (list.error()) {
      <p class="form-error" role="alert">{{ errorText() }}</p>
    } @else if (list.value()?.items?.length) {
      <ul class="items">
        @for (o of list.value()!.items; track o.id) {
          <li>
            <a class="item glass" [routerLink]="['/marketplace/orders', o.id]">
              <span class="main">
                <strong class="mono">{{ o.orderNumber }}</strong>
                <span class="subtle small"
                  >{{ o.items.length }} item{{ o.items.length === 1 ? '' : 's' }} ·
                  {{ ago(o.createdAt) }}</span
                >
              </span>
              <span class="num total">{{ money(o.totalSle) }}</span>
              <status-pill [status]="o.status" />
            </a>
          </li>
        }
      </ul>
      <glass-paginator
        [page]="list.value()!.page"
        [pageSize]="list.value()!.pageSize"
        [total]="list.value()!.totalCount"
        [pages]="list.value()!.totalPages"
        (pageChange)="q.setPage($event)"
      />
    } @else {
      <glass-card>
        <empty-state
          heading="No orders yet"
          message="Orders you place appear here."
          [icon]="i.ReceiptText"
        >
          <a glass-button size="sm" variant="primary" routerLink="/marketplace">Browse</a>
        </empty-state>
      </glass-card>
    }
  `,
  styles: `
    .h1 {
      font-size: var(--fs-2xl);
      margin-bottom: var(--s-4);
    }
    .items {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--s-2);
    }
    .item {
      display: flex;
      align-items: center;
      gap: var(--s-3);
      min-height: 68px;
      padding: var(--s-3) var(--s-4);
      border-radius: var(--r-lg);
      color: var(--text-1);
      text-decoration: none;
    }
    .main {
      flex: 1;
      display: grid;
      gap: 2px;
    }
    .small {
      font-size: var(--fs-xs);
    }
    .total {
      font-weight: 700;
    }
  `,
})
export class MyOrders {
  private readonly orders = inject(OrdersApi);
  protected readonly i = { ReceiptText };
  protected readonly q = urlQuery({});
  protected readonly list = rxResource({
    params: () => this.q.page(),
    stream: ({ params: page }) => this.orders.mine({ page, pageSize: 10 }),
  });
  protected readonly errorText = computed(() => errorMessage(this.list.error()));
  protected money(v: number): string {
    return formatSle(v);
  }
  protected ago(v: string): string {
    return relativeTime(v);
  }
}

/** One of my orders: items, status, cancel while Pending. */
@Component({
  selector: 'my-order',
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
    <a class="back" routerLink="/marketplace/orders"
      ><lucide-icon [img]="i.ArrowLeft" [size]="16" aria-hidden="true" /> My orders</a
    >
    @if (order.value(); as o) {
      @if (justPlaced() && o.status === 'Pending') {
        <p class="banner ok" role="status">
          Order placed and items reserved. Pay by Orange Money, Afrimoney or cash at the hub,
          quoting {{ o.orderNumber }}.
        </p>
      }
      <glass-card variant="strong">
        <div class="row head">
          <div>
            <p class="eyebrow">Order</p>
            <h1 class="mono">{{ o.orderNumber }}</h1>
          </div>
          <status-pill [status]="o.status" />
        </div>
        <ul class="items">
          @for (it of o.items; track it.listingId) {
            <li>
              <span
                >{{ it.title }}
                @if (it.certificateNumber) {
                  <br /><a class="trust" [routerLink]="['/verify', it.certificateNumber]"
                    ><lucide-icon [img]="i.BadgeCheck" [size]="12" aria-hidden="true" />
                    {{ it.certificateNumber }}</a
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
            <dt>Placed</dt>
            <dd>{{ when(o.createdAt) }}</dd>
          </div>
          @if (o.paidAt) {
            <div>
              <dt>Paid</dt>
              <dd>{{ when(o.paidAt) }}</dd>
            </div>
          }
          @if (o.fulfilledAt) {
            <div>
              <dt>Handed over</dt>
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
          <p class="banner info">
            Thank you: {{ money(r.totalReinvestedSle) }} of your purchase goes back into buying
            phones and training young technicians.
          </p>
        }
        @if (o.status === 'Pending') {
          <button glass-button variant="danger" type="button" (click)="cancel(o)">
            Cancel order
          </button>
        }
      </glass-card>
    } @else if (order.error()) {
      <empty-state heading="Order not found" [message]="errorText()" />
    } @else {
      <skeleton [lines]="6" />
    }
  `,
  styles: `
    .back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: var(--s-3);
      font-size: var(--fs-sm);
      font-weight: 600;
      text-decoration: none;
    }
    .banner {
      margin-bottom: var(--s-3);
    }
    .head {
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--s-3);
    }
    .head h1 {
      font-size: var(--fs-2xl);
    }
    .items {
      list-style: none;
      margin: 0 0 var(--s-4);
      padding: 0;
      display: grid;
    }
    .items li {
      display: flex;
      justify-content: space-between;
      gap: var(--s-2);
      padding: 10px 0;
      border-bottom: 1px solid var(--field-border);
      font-size: var(--fs-sm);
    }
    .items .total {
      border-bottom: 0;
      font-weight: 700;
      font-size: var(--fs-base);
    }
    .trust {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: var(--fs-xs);
      color: var(--success);
    }
    dl {
      margin-bottom: var(--s-4);
    }
  `,
})
export class MyOrder {
  readonly id = input.required<string>();
  /** `?placed=1` right after checkout. */
  readonly placed = input<string>();
  private readonly orders = inject(OrdersApi);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);
  protected readonly i = { ArrowLeft, BadgeCheck };
  protected readonly justPlaced = computed(() => this.placed() === '1');
  protected readonly order = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.orders.get(id),
  });
  protected readonly errorText = computed(() => errorMessage(this.order.error()));

  protected cancel(o: Order): void {
    const data: ReasonDialogData = {
      title: `Cancel ${o.orderNumber}?`,
      message: 'The items go back on sale for other buyers.',
      confirmLabel: 'Cancel order',
      ...ORDER_CANCEL,
      danger: true,
      submit: (reason) => this.orders.cancel(o.id, reason),
    };
    this.modal.open<Order | null>(ReasonDialog, data).closed.subscribe((res) => {
      if (res === undefined) return;
      if (res) this.toast.success('Order cancelled.');
      this.order.reload();
    });
  }
  protected money(v: number): string {
    return formatSle(v);
  }
  protected when(v: string | null): string {
    return formatDateTime(v);
  }
}
