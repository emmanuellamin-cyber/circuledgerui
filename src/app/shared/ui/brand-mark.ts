import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** CircuLedger mark: a phone inside a closing loop (circularity). Original artwork. */
@Component({
  selector: 'brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#12b886" />
          <stop offset="0.55" stop-color="#0b8a8a" />
          <stop offset="1" stop-color="#0a5f8f" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#bm-g)" />
      <rect x="1" y="1" width="38" height="19" rx="11" fill="#fff" opacity="0.16" />
      <path
        d="M29.5 13.5a11 11 0 1 0 1 9.5"
        fill="none"
        stroke="#fff"
        stroke-width="2.4"
        stroke-linecap="round"
      />
      <path
        d="M31.2 9.8l-.6 4.6-4.5-1"
        fill="none"
        stroke="#fbbf24"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <rect
        x="15.5"
        y="12.5"
        width="9"
        height="15"
        rx="2.2"
        fill="none"
        stroke="#fff"
        stroke-width="2"
      />
      <circle cx="20" cy="24.4" r="1" fill="#fff" />
    </svg>
    @if (wordmark()) {
      <span class="word">Circu<span>Ledger</span></span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    svg {
      border-radius: 12px;
      box-shadow: 0 6px 16px -6px rgb(10 95 143 / 0.55);
    }
    .word {
      font-weight: 750;
      font-size: 1.12rem;
      letter-spacing: -0.03em;
      color: var(--text-1);
    }
    .word span {
      color: var(--accent-ink);
    }
    /* Very narrow phones: icon only, so a signed-in nav bar still fits. */
    @media (max-width: 359.98px) {
      :host(.compact-on-phone) .word {
        display: none;
      }
    }
  `,
  host: { '[class.compact-on-phone]': 'compactOnPhone()' },
})
export class BrandMark {
  readonly size = input(34);
  readonly wordmark = input(true);
  /** Hides the wordmark below 360px. Only use where the mark has an accessible label. */
  readonly compactOnPhone = input(false);
}
