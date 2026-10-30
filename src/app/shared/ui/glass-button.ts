import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LiquidDirective } from './liquid.directive';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'amber';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Pill button applied to a native `<button>` or `<a>` so keyboard, forms and screen readers
 * behave natively: `<button glass-button variant="primary">Save</button>`.
 */
@Component({
  selector: 'button[glass-button], a[glass-button]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [LiquidDirective],
  host: {
    class: 'glass-button liquid--lift',
    '[class]': 'classes()',
    '[attr.aria-busy]': 'loading() || null',
    '[attr.disabled]': 'loading() || disabled() ? true : null',
    '[attr.aria-disabled]': 'loading() || disabled() ? true : null',
  },
  template: `
    @if (loading()) {
      <span class="spinner" aria-hidden="true"></span>
    }
    <span class="label"><ng-content /></span>
  `,
  styles: `
    :host {
      position: relative;
      isolation: isolate;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--s-2);
      min-height: var(--touch);
      padding: 0 var(--s-5);
      border: 0;
      border-radius: var(--r-pill);
      font-weight: 600;
      font-size: var(--fs-sm);
      letter-spacing: -0.005em;
      line-height: 1;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      color: var(--text-1);
      background: var(--glass-fill);
      -webkit-backdrop-filter: blur(16px) saturate(170%);
      backdrop-filter: blur(16px) saturate(170%);
      box-shadow:
        inset 0 1px 0 0 var(--glass-rim),
        inset 0 0 0 1px var(--glass-rim),
        0 0 0 1px var(--glass-edge),
        0 6px 16px -8px rgb(4 32 27 / 0.3);
    }
    :host::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      border-radius: inherit;
      background: var(--glass-highlight);
      pointer-events: none;
    }
    .label {
      display: inline-flex;
      align-items: center;
      gap: var(--s-2);
    }

    :host(.v-primary) {
      color: var(--text-on-accent);
      background: var(--accent-gradient);
      box-shadow:
        inset 0 1px 0 0 rgb(255 255 255 / 0.35),
        inset 0 0 0 1px rgb(255 255 255 / 0.12),
        0 8px 22px -8px rgb(11 122 98 / 0.65);
    }
    :host(.v-amber) {
      color: #241300;
      background: var(--amber-gradient);
      box-shadow:
        inset 0 1px 0 0 rgb(255 255 255 / 0.45),
        0 8px 22px -8px rgb(234 122 12 / 0.6);
    }
    :host(.v-danger) {
      color: #fff;
      background: linear-gradient(135deg, #c62828, #a11b1b);
      box-shadow:
        inset 0 1px 0 rgb(255 255 255 / 0.3),
        0 8px 22px -8px rgb(185 28 28 / 0.55);
    }
    :host(.v-ghost) {
      background: transparent;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
      box-shadow: none;
      &::before {
        display: none;
      }
      @media (hover: hover) {
        &:hover {
          background: var(--neutral-bg);
        }
      }
    }

    :host(.s-sm) {
      min-height: 36px;
      padding: 0 var(--s-4);
      font-size: var(--fs-xs);
    }
    :host(.s-lg) {
      min-height: 54px;
      padding: 0 var(--s-6);
      font-size: var(--fs-base);
    }
    :host(.block) {
      width: 100%;
    }
    :host(.icon-only) {
      padding: 0;
      width: var(--touch);
    }
    :host(.icon-only.s-sm) {
      width: 36px;
    }

    :host([disabled]) {
      opacity: 0.55;
      cursor: not-allowed;
      transform: none !important;
    }

    .spinner {
      width: 1em;
      height: 1em;
      border-radius: 50%;
      border: 2px solid currentColor;
      border-right-color: transparent;
      animation: spin 0.7s linear infinite;
    }
    :host([aria-busy='true']) .label {
      opacity: 0.8;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class GlassButton {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly block = input(false);
  readonly iconOnly = input(false);

  protected readonly classes = computed(
    () =>
      `glass-button liquid liquid--lift v-${this.variant()} s-${this.size()}` +
      (this.block() ? ' block' : '') +
      (this.iconOnly() ? ' icon-only' : ''),
  );
}
