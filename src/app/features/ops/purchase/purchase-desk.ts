import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Coins, HandCoins, LucideAngularModule, Receipt } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { FundsApi } from '../../../core/api/commerce.api';
import { DevicesApi } from '../../../core/api/devices.api';
import type { Device, Purchase } from '../../../core/api/types';
import { DEVICE_CONDITION_LABELS, PAYOUT_METHOD_LABELS } from '../../../core/enums/labels';
import { formatSle, relativeTime } from '../../../core/format/format';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  GlassTab,
  GlassTabs,
  ModalService,
  PageHeader,
  Skeleton,
  StatTile,
} from '../../../shared/ui';
import { PayoutDialog, PurchaseDialog } from '../shared/ops-dialogs';

type Tab = 'buy' | 'payouts';

/** Purchase desk (§8.8): buy received phones from the Seed Fund, then record payouts. */
@Component({
  selector: 'purchase-desk',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    GlassTabs,
    StatTile,
    Skeleton,
    EmptyState,
  ],
  template: `
    <page-header
      heading="Purchase desk"
      subheading="Buy received phones at the matrix price, then confirm the payout to the seller."
    />
    <div class="kpi-grid top">
      <stat-tile
        label="Seed Fund balance"
        [value]="balance()"
        caption="each purchase is debited here"
        [icon]="i.Coins"
      />
      <stat-tile
        label="Waiting to be bought"
        [value]="toBuyCount()"
        caption="devices in Received"
        [icon]="i.HandCoins"
      />
      <stat-tile
        label="Payouts pending"
        [value]="'' + pending().length"
        caption="sellers not yet paid"
        [icon]="i.Receipt"
      />
    </div>

    <glass-tabs [tabs]="tabs()" [(selected)]="tab" ariaLabel="Purchase desk view" />

    <glass-card padding="sm" class="list">
      @if (tab() === 'buy') {
        <div [attr.aria-busy]="received.isLoading()">
          @if (received.isLoading() && !received.value()) {
            <skeleton [lines]="6" height="22px" />
          } @else if (received.error()) {
            <div class="form-error" role="alert">
              {{ err(received.error()) }}
              <button glass-button size="sm" type="button" (click)="received.reload()">
                Retry
              </button>
            </div>
          } @else if (received.value()?.items?.length) {
            <table class="data">
              <caption class="sr-only">
                Devices waiting to be bought
              </caption>
              <thead>
                <tr>
                  <th scope="col">Tracking ID</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Condition</th>
                  <th scope="col">Received</th>
                  <th scope="col"><span class="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                @for (d of received.value()!.items; track d.id) {
                  <tr>
                    <td data-label="Tracking ID">
                      <a class="row-link mono" [routerLink]="['/ops/devices', d.id]">{{
                        d.trackingId
                      }}</a>
                    </td>
                    <td data-label="Phone">{{ d.brand }}{{ d.model ? ' ' + d.model : '' }}</td>
                    <td data-label="Condition">{{ conditionLabels[d.condition] }}</td>
                    <td data-label="Received">
                      {{ ago(d.createdAt) }} · {{ d.locationName ?? '—' }}
                    </td>
                    <td class="r">
                      <button
                        glass-button
                        size="sm"
                        variant="primary"
                        type="button"
                        (click)="buy(d)"
                      >
                        Purchase
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <empty-state
              heading="Nothing to buy right now"
              message="Phones appear here once they are received at a hub."
              [icon]="i.HandCoins"
            >
              <a glass-button size="sm" routerLink="/ops/intake">Open intake inbox</a>
            </empty-state>
          }
        </div>
      } @else {
        <div [attr.aria-busy]="recent.isLoading()">
          @if (recent.isLoading() && !recent.value()) {
            <skeleton [lines]="6" height="22px" />
          } @else if (pending().length) {
            <table class="data">
              <caption class="sr-only">
                Purchases with a pending payout
              </caption>
              <thead>
                <tr>
                  <th scope="col">Tracking ID</th>
                  <th scope="col" class="r">Amount</th>
                  <th scope="col">Method</th>
                  <th scope="col">Bought</th>
                  <th scope="col"><span class="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                @for (d of pending(); track d.id) {
                  <tr>
                    <td data-label="Tracking ID">
                      <a class="row-link mono" [routerLink]="['/ops/devices', d.id]">{{
                        d.trackingId
                      }}</a>
                    </td>
                    <td data-label="Amount" class="r num">{{ money(d.purchase!.paidPriceSle) }}</td>
                    <td data-label="Method">{{ payoutLabels[d.purchase!.payoutMethod] }}</td>
                    <td data-label="Bought">{{ ago(d.purchase!.purchasedAt) }}</td>
                    <td class="r">
                      <button
                        glass-button
                        size="sm"
                        variant="primary"
                        type="button"
                        (click)="payout(d)"
                      >
                        Record payout
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            <p class="subtle tiny">From the 100 most recent devices.</p>
          } @else {
            <empty-state
              heading="All sellers are paid"
              message="Purchases with a pending payout show up here."
              [icon]="i.Receipt"
            />
          }
        </div>
      }
    </glass-card>
  `,
  styles: `
    .top {
      margin-bottom: var(--s-4);
    }
    .list {
      margin-top: var(--s-3);
    }
    .tiny {
      font-size: var(--fs-xs);
      margin-top: var(--s-2);
    }
  `,
})
export class PurchaseDesk {
  private readonly devices = inject(DevicesApi);
  private readonly funds = inject(FundsApi);
  private readonly modal = inject(ModalService);
  protected readonly i = { Coins, HandCoins, Receipt };
  protected readonly conditionLabels = DEVICE_CONDITION_LABELS;
  protected readonly payoutLabels = PAYOUT_METHOD_LABELS;
  protected readonly tab = signal<Tab>('buy');

  protected readonly received = rxResource({
    stream: () => this.devices.list({ status: 'Received', pageSize: 50 }),
  });
  /** No payout filter exists on GET /devices (see README backend questions), so filter recent devices. */
  protected readonly recent = rxResource({ stream: () => this.devices.list({ pageSize: 100 }) });
  private readonly fundsRes = rxResource({ stream: () => this.funds.overview({ pageSize: 1 }) });

  protected readonly pending = computed(() =>
    (this.recent.value()?.items ?? []).filter((d) => d.purchase?.payoutStatus === 'Pending'),
  );
  protected readonly balance = computed(() =>
    formatSle(this.fundsRes.value()?.funds.find((f) => f.type === 'SeedFund')?.balanceSle),
  );
  protected readonly toBuyCount = computed(() => String(this.received.value()?.totalCount ?? '…'));
  protected readonly tabs = computed<GlassTab<Tab>[]>(() => [
    { id: 'buy', label: 'To buy', badge: this.received.value()?.totalCount },
    { id: 'payouts', label: 'Payouts pending', badge: this.pending().length },
  ]);

  protected buy(d: Device): void {
    this.modal.open<Purchase>(PurchaseDialog, d).closed.subscribe((p) => {
      if (!p) return;
      this.received.reload();
      this.recent.reload();
      this.fundsRes.reload();
    });
  }
  protected payout(d: Device): void {
    this.modal.open<Purchase>(PayoutDialog, d).closed.subscribe((p) => p && this.recent.reload());
  }
  protected money(v: number): string {
    return formatSle(v);
  }
  protected ago(v: string): string {
    return relativeTime(v);
  }
  protected err(e: unknown): string {
    return errorMessage(e);
  }
}
