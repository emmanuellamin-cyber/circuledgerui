import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule, ReceiptText, ShoppingBag, Store } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { POLICY } from '../../core/auth/roles';
import { CartService } from './cart.service';

/** Marketplace section inside the public shell: Browse · Cart · My orders (Buyer). */
@Component({
  selector: 'marketplace-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  template: `
    <div class="container wrap">
      <nav class="sub glass glass--subtle" aria-label="Marketplace">
        <a
          routerLink="/marketplace"
          routerLinkActive="on"
          [routerLinkActiveOptions]="{ exact: true }"
          ariaCurrentWhenActive="page"
        >
          <lucide-icon [img]="i.Store" [size]="17" aria-hidden="true" /> Browse
        </a>
        <a routerLink="/marketplace/cart" routerLinkActive="on" ariaCurrentWhenActive="page">
          <lucide-icon [img]="i.ShoppingBag" [size]="17" aria-hidden="true" /> Cart
          @if (cart.count()) {
            <span class="badge num" [attr.aria-label]="cart.count() + ' items'">{{
              cart.count()
            }}</span>
          }
        </a>
        @if (isBuyer()) {
          <a routerLink="/marketplace/orders" routerLinkActive="on" ariaCurrentWhenActive="page">
            <lucide-icon [img]="i.ReceiptText" [size]="17" aria-hidden="true" /> My orders
          </a>
        }
      </nav>
      <router-outlet />
    </div>
  `,
  styles: `
    .wrap {
      padding-block: var(--s-4) var(--s-7);
    }
    .sub {
      display: flex;
      width: fit-content;
      gap: 4px;
      padding: 4px;
      margin-bottom: var(--s-4);
      border-radius: var(--r-pill);
      max-width: 100%;
      overflow-x: auto;
    }
    .sub a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 40px;
      padding: 0 16px;
      border-radius: var(--r-pill);
      color: var(--text-2);
      font-size: var(--fs-sm);
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
    }
    .sub a.on {
      background: var(--glass-fill-strong);
      color: var(--text-1);
      box-shadow: inset 0 1px 0 var(--glass-rim);
    }
    .badge {
      min-width: 20px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--accent);
      color: #fff;
      font-size: 11px;
      line-height: 20px;
      text-align: center;
    }
  `,
})
export class MarketplaceShell {
  protected readonly cart = inject(CartService);
  private readonly auth = inject(AuthService);
  protected readonly i = { Store, ShoppingBag, ReceiptText };
  protected readonly isBuyer = computed(
    () => this.auth.isAuthenticated() && this.auth.hasRole(...POLICY.Buyer),
  );
}
