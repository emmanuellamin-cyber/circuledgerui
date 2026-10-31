import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, forkJoin, map, of } from 'rxjs';
import { BadgeCheck, LucideAngularModule, ShoppingBag, Smartphone, Trash2 } from 'lucide-angular';
import { isApiError } from '../../core/api/api-error';
import { OrdersApi } from '../../core/api/commerce.api';
import { PublicApi } from '../../core/api/public.api';
import { AuthService } from '../../core/auth/auth.service';
import { POLICY } from '../../core/auth/roles';
import { formatSle } from '../../core/format/format';
import { useAction } from '../../core/state/action';
import { EmptyState, GlassButton, GlassCard } from '../../shared/ui';
import { CartItem, CartService } from './cart.service';

/**
 * Cart and checkout (§8.14). POST /orders reserves all items atomically. On
 * 409 listing_unavailable, re-check every item and drop the ones that are gone (§13).
 */
@Component({
  selector: 'marketplace-cart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, GlassCard, GlassButton, EmptyState],
  template: `
    <h1 class="h1">Your cart</h1>
    @if (removed().length) {
      <p class="banner warn" role="alert">
        Someone else just reserved or bought
        {{ removed().length === 1 ? 'this item' : 'these items' }}, so
        {{ removed().length === 1 ? 'it was' : 'they were' }} removed: {{ removed().join(', ') }}.
        @if (cart.count()) {
          Check the rest and try again.
        }
      </p>
    }
    @if (cart.count()) {
      <div class="layout">
        <glass-card padding="sm">
          <ul class="items">
            @for (it of cart.items(); track it.listingId) {
              <li>
                <a class="thumb" [routerLink]="['/marketplace/listing', it.listingId]">
                  @if (it.photoUrl) {
                    <img [src]="it.photoUrl" alt="" />
                  } @else {
                    <lucide-icon [img]="i.Smartphone" [size]="28" aria-hidden="true" />
                  }
                </a>
                <div class="txt">
                  <a [routerLink]="['/marketplace/listing', it.listingId]" class="title">{{
                    it.title
                  }}</a>
                  @if (it.certificateNumber) {
                    <span class="trust"
                      ><lucide-icon [img]="i.BadgeCheck" [size]="13" aria-hidden="true" /> Data
                      wiped · {{ it.certificateNumber }}</span
                    >
                  }
                </div>
                <span class="num price">{{ money(it.priceSle) }}</span>
                <button
                  type="button"
                  class="rm"
                  [attr.aria-label]="'Remove ' + it.title"
                  (click)="cart.remove(it.listingId)"
                >
                  <lucide-icon [img]="i.Trash2" [size]="16" />
                </button>
              </li>
            }
          </ul>
        </glass-card>
        <glass-card variant="strong" heading="Summary">
          <p class="total">
            <span>Total</span><strong class="num">{{ money(cart.total()) }}</strong>
          </p>
          <p class="subtle small">
            Checkout reserves the items. Pay by Orange Money, Afrimoney or cash at the hub; staff
            confirm the payment and hand the items over.
          </p>
          @if (action.error(); as e) {
            <p class="form-error" role="alert">{{ e }}</p>
          }
          @if (canBuy()) {
            <button
              glass-button
              variant="primary"
              size="lg"
              type="button"
              [block]="true"
              [loading]="action.busy()"
              (click)="checkout()"
            >
              <lucide-icon [img]="i.ShoppingBag" [size]="18" aria-hidden="true" /> Place order
            </button>
          } @else if (auth.isAuthenticated()) {
            <p class="banner info">
              Your account can't place orders. Sign in with a buyer account.
            </p>
          } @else {
            <a
              glass-button
              variant="primary"
              size="lg"
              [block]="true"
              routerLink="/login"
              [queryParams]="{ returnUrl: '/marketplace/cart' }"
              >Log in to check out</a
            >
            <p class="small center">New? <a routerLink="/register">Create a buyer account</a></p>
          }
        </glass-card>
      </div>
    } @else {
      <glass-card>
        <empty-state
          heading="Your cart is empty"
          message="Browse certified refurbished phones and parts."
          [icon]="i.ShoppingBag"
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
    .banner {
      margin-bottom: var(--s-3);
    }
    .layout {
      display: grid;
      gap: var(--s-4);
      align-items: start;
    }
    @media (min-width: 900px) {
      .layout {
        grid-template-columns: 1.5fr 1fr;
      }
    }
    .items {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
    }
    .items li {
      display: grid;
      grid-template-columns: 64px 1fr auto auto;
      gap: var(--s-3);
      align-items: center;
      padding: var(--s-3) var(--s-2);
      border-bottom: 1px solid var(--field-border);
    }
    .items li:last-child {
      border-bottom: 0;
    }
    .thumb {
      display: grid;
      place-items: center;
      width: 64px;
      height: 52px;
      border-radius: 12px;
      overflow: hidden;
      background: var(--glass-fill-nested);
      color: var(--text-3);
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .txt {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .title {
      color: var(--text-1);
      font-weight: 600;
      text-decoration: none;
      font-size: var(--fs-sm);
    }
    .trust {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--fs-xs);
      color: var(--success);
      font-weight: 600;
    }
    .price {
      font-weight: 700;
    }
    .rm {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 50%;
      background: var(--neutral-bg);
      color: var(--text-2);
      cursor: pointer;
    }
    .total {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: var(--s-3);
      font-size: var(--fs-lg);
    }
    .total strong {
      font-size: var(--fs-2xl);
    }
    .small {
      font-size: var(--fs-sm);
      margin-bottom: var(--s-3);
    }
    .center {
      text-align: center;
      margin-top: var(--s-3);
    }
    /* A single auto column would grow to its content and push the cards off narrow screens. */
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .total {
      flex-wrap: wrap;
      gap: var(--s-2);
    }
    .total strong,
    .price {
      white-space: nowrap;
    }
    .trust {
      align-items: flex-start;
    }
    .trust lucide-icon {
      flex: none;
      margin-top: 1px;
    }
    /* Phones: title and certificate get the full middle column, the price goes under them. */
    @media (max-width: 639.98px) {
      .items li {
        grid-template-columns: 56px minmax(0, 1fr) auto;
        grid-template-areas:
          'thumb txt rm'
          'thumb price rm';
        row-gap: 4px;
        padding-inline: var(--s-1);
      }
      .thumb {
        grid-area: thumb;
        width: 56px;
        height: 56px;
        align-self: start;
      }
      .txt {
        grid-area: txt;
      }
      .price {
        grid-area: price;
      }
      .rm {
        grid-area: rm;
        align-self: start;
      }
      .total strong {
        font-size: var(--fs-xl);
      }
    }
  `,
})
export class MarketplaceCart {
  protected readonly cart = inject(CartService);
  protected readonly auth = inject(AuthService);
  private readonly orders = inject(OrdersApi);
  private readonly publicApi = inject(PublicApi);
  private readonly router = inject(Router);
  protected readonly i = { ShoppingBag, Trash2, BadgeCheck, Smartphone };
  protected readonly action = useAction();
  protected readonly removed = signal<string[]>([]);
  protected readonly canBuy = computed(
    () => this.auth.isAuthenticated() && this.auth.hasRole(...POLICY.Buyer),
  );

  async checkout(): Promise<void> {
    this.removed.set([]);
    try {
      const order = await firstValueFrom(
        this.orders.create({ listingIds: this.cart.items().map((i) => i.listingId) }),
      );
      this.cart.clear();
      await this.router.navigate(['/marketplace/orders', order.id], { queryParams: { placed: 1 } });
    } catch (e) {
      if (isApiError(e) && e.code === 'listing_unavailable') {
        await this.dropUnavailable();
      } else {
        await this.action.run(() => Promise.reject(e));
      }
    }
  }

  /** Re-fetch every cart item; anything not Published any more is removed. */
  private async dropUnavailable(): Promise<void> {
    const checks = this.cart.items().map((it: CartItem) =>
      this.publicApi.listing(it.listingId).pipe(
        map((l) => ({ it, ok: l.status === 'Published' })),
        catchError(() => of({ it, ok: false })),
      ),
    );
    const results = await firstValueFrom(forkJoin(checks));
    const gone = results.filter((r) => !r.ok).map((r) => r.it);
    gone.forEach((g) => this.cart.remove(g.listingId));
    this.removed.set(gone.length ? gone.map((g) => g.title) : ['an item']);
  }

  protected money(v: number): string {
    return formatSle(v);
  }
}
