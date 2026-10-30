import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  ArrowLeft,
  BadgeCheck,
  LucideAngularModule,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
} from 'lucide-angular';
import { errorMessage } from '../../core/api/api-error';
import { PublicApi } from '../../core/api/public.api';
import { SANITIZATION_METHOD_LABELS, humanize } from '../../core/enums/labels';
import { formatDate, formatSle } from '../../core/format/format';
import { EmptyState, GlassButton, GlassCard, Skeleton, ToastService } from '../../shared/ui';
import { CartService } from './cart.service';

/** Product page (§9 D): photos, details and a live certificate check as the trust badge. */
@Component({
  selector: 'marketplace-product',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, GlassCard, GlassButton, Skeleton, EmptyState],
  template: `
    <a class="back" routerLink="/marketplace"
      ><lucide-icon [img]="i.ArrowLeft" [size]="16" aria-hidden="true" /> All items</a
    >
    @if (listing.value(); as l) {
      <div class="layout">
        <section class="gallery" aria-label="Photos">
          <div class="main glass">
            @if (photos()[active()]; as src) {
              <img
                [src]="src"
                [alt]="l.title + ', photo ' + (active() + 1) + ' of ' + photos().length"
              />
            } @else {
              <span class="ph" aria-hidden="true"
                ><lucide-icon [img]="i.Smartphone" [size]="56"
              /></span>
            }
          </div>
          @if (photos().length > 1) {
            <div class="thumbs" role="group" aria-label="Choose photo">
              @for (src of photos(); track src; let n = $index) {
                <button
                  type="button"
                  class="thumb"
                  [class.on]="n === active()"
                  [attr.aria-label]="'Photo ' + (n + 1)"
                  [attr.aria-pressed]="n === active()"
                  (click)="active.set(n)"
                >
                  <img [src]="src" alt="" />
                </button>
              }
            </div>
          }
        </section>

        <section class="info">
          <h1>{{ l.title }}</h1>
          <p class="price num">{{ money(l.priceSle) }}</p>
          <dl class="dl">
            <div>
              <dt>Brand</dt>
              <dd>{{ l.brand }}{{ l.model ? ' ' + l.model : '' }}</dd>
            </div>
            <div>
              <dt>Grade</dt>
              <dd>{{ l.condition }}</dd>
            </div>
            <div>
              <dt>Warranty</dt>
              <dd>{{ l.warrantyDays }} days</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>
                {{
                  l.itemType === 'Component'
                    ? humanize(l.componentType) + ' (part)'
                    : 'Refurbished phone'
                }}
              </dd>
            </div>
          </dl>
          @if (l.description) {
            <p class="desc">{{ l.description }}</p>
          }
          <button
            glass-button
            variant="primary"
            size="lg"
            type="button"
            [block]="true"
            [disabled]="cart.has(l.id)"
            (click)="add()"
          >
            <lucide-icon [img]="i.ShoppingBag" [size]="18" aria-hidden="true" />
            {{ cart.has(l.id) ? 'In your cart' : 'Add to cart' }}
          </button>
          @if (cart.has(l.id)) {
            <a class="go-cart" routerLink="/marketplace/cart">Go to cart</a>
          }

          @if (l.certificateNumber) {
            <glass-card padding="sm" class="trust" aria-live="polite">
              @if (cert.isLoading()) {
                <p class="row">
                  <span class="spin" aria-hidden="true"></span> Checking certificate
                  {{ l.certificateNumber }}…
                </p>
              } @else if (cert.value(); as c) {
                @if (c.isValid) {
                  <div class="t ok">
                    <lucide-icon [img]="i.ShieldCheck" [size]="26" aria-hidden="true" />
                    <div>
                      <strong>Data securely wiped ✓</strong>
                      <p class="small">
                        Certificate <span class="mono">{{ c.certificateNumber }}</span> ·
                        {{ c.method ? methodLabels[c.method] : '' }} · issued {{ date(c.issuedAt) }}
                      </p>
                    </div>
                  </div>
                } @else {
                  <div class="t bad">
                    <lucide-icon [img]="i.ShieldAlert" [size]="26" aria-hidden="true" />
                    <div>
                      <strong>Certificate {{ c.status.toLowerCase() }}</strong>
                      <p class="small">{{ c.reason ?? 'Ask the Hub before buying.' }}</p>
                    </div>
                  </div>
                }
                <a class="small" [routerLink]="['/verify', l.certificateNumber]"
                  >Verify it yourself</a
                >
              } @else {
                <p class="small">
                  <lucide-icon [img]="i.BadgeCheck" [size]="14" aria-hidden="true" /> Certificate
                  <span class="mono">{{ l.certificateNumber }}</span> ·
                  <a [routerLink]="['/verify', l.certificateNumber]">verify</a>
                </p>
              }
            </glass-card>
          }
        </section>
      </div>
    } @else if (listing.error()) {
      <empty-state heading="This item isn't available" [message]="errorText()">
        <a glass-button size="sm" routerLink="/marketplace">Browse other items</a>
      </empty-state>
    } @else {
      <div class="layout"><skeleton height="360px" radius="22px" /><skeleton [lines]="6" /></div>
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
    .layout {
      display: grid;
      gap: var(--s-5);
    }
    @media (min-width: 900px) {
      .layout {
        grid-template-columns: 1.1fr 0.9fr;
        align-items: start;
      }
    }
    .main {
      aspect-ratio: 4 / 3;
      padding: 8px;
      border-radius: var(--r-xl);
      overflow: hidden;
    }
    .main img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: var(--r-lg);
    }
    .ph {
      display: grid;
      place-items: center;
      height: 100%;
      color: var(--text-3);
    }
    .thumbs {
      display: flex;
      gap: var(--s-2);
      margin-top: var(--s-2);
      overflow-x: auto;
    }
    .thumb {
      flex: none;
      width: 72px;
      height: 56px;
      padding: 0;
      border: 0;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      opacity: 0.7;
    }
    .thumb.on {
      opacity: 1;
      box-shadow: 0 0 0 2px var(--accent);
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .info {
      display: grid;
      gap: var(--s-3);
    }
    .info h1 {
      font-size: var(--fs-2xl);
    }
    .price {
      font-size: var(--fs-3xl);
      font-weight: 780;
      letter-spacing: -0.03em;
    }
    .desc {
      white-space: pre-wrap;
      color: var(--text-2);
    }
    .go-cart {
      justify-self: center;
      font-size: var(--fs-sm);
      font-weight: 600;
    }
    .t {
      display: flex;
      gap: var(--s-3);
      align-items: flex-start;
      margin-bottom: var(--s-2);
    }
    .t.ok lucide-icon {
      color: var(--success);
    }
    .t.bad lucide-icon {
      color: var(--danger);
    }
    .small {
      font-size: var(--fs-sm);
    }
    .spin {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid currentColor;
      border-right-color: transparent;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class MarketplaceProduct {
  readonly id = input.required<string>();
  private readonly api = inject(PublicApi);
  protected readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  protected readonly i = {
    ArrowLeft,
    BadgeCheck,
    ShieldCheck,
    ShieldAlert,
    ShoppingBag,
    Smartphone,
  };
  protected readonly methodLabels = SANITIZATION_METHOD_LABELS;
  protected readonly humanize = humanize;
  protected readonly active = signal(0);

  protected readonly listing = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.api.listing(id),
  });
  /** Trust badge backed by the public verify endpoint (§9 D). */
  protected readonly cert = rxResource({
    params: () => this.listing.value()?.certificateNumber ?? undefined,
    stream: ({ params: no }) => this.api.verifyCertificate(no),
  });
  /** Public responses only include verified photos (§5). */
  protected readonly photos = computed(() =>
    (this.listing.value()?.photos ?? []).map((p) => this.api.photoSrc(p.url)),
  );
  protected readonly errorText = computed(() =>
    errorMessage(this.listing.error(), 'It may have been sold.'),
  );

  protected add(): void {
    const l = this.listing.value();
    if (!l) return;
    if (this.cart.full()) {
      this.toast.show('A cart holds up to 20 items.', 'warning');
      return;
    }
    if (this.cart.add(l, this.photos()[0] ?? null)) this.toast.success('Added to your cart.');
  }
  protected money(v: number): string {
    return formatSle(v);
  }
  protected date(v: string | null): string {
    return formatDate(v);
  }
}
