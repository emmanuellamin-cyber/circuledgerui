import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LiquidDirective } from './liquid.directive';

export type GlassVariant = 'default' | 'strong' | 'subtle';

/**
 * Translucent panel. Optional `heading` / `subheading` render a consistent header; project
 * `[card-actions]` for header actions. `interactive` adds the liquid hover + lift.
 */
@Component({
  selector: 'glass-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [LiquidDirective],
  host: {
    class: 'glass',
    '[class.glass--strong]': "variant() === 'strong'",
    '[class.glass--subtle]': "variant() === 'subtle'",
    '[class.glass--lens]': 'lens()',
    '[class.liquid--lift]': 'interactive()',
    '[class.pad-sm]': "padding() === 'sm'",
    '[class.pad-lg]': "padding() === 'lg'",
    '[class.pad-none]': "padding() === 'none'",
  },
  template: `
    @if (heading()) {
      <header class="head">
        <div class="titles">
          <h3>{{ heading() }}</h3>
          @if (subheading()) {
            <p class="muted">{{ subheading() }}</p>
          }
        </div>
        <ng-content select="[card-actions]" />
      </header>
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: block;
      padding: var(--s-5);
      border-radius: var(--r-xl);
      &.pad-sm {
        padding: var(--s-4);
        border-radius: var(--r-lg);
      }
      &.pad-lg {
        padding: clamp(var(--s-5), 4vw, var(--s-6));
      }
      &.pad-none {
        padding: 0;
      }
    }
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--s-3);
      margin-bottom: var(--s-4);
    }
    .titles {
      display: grid;
      gap: 2px;
    }
    .titles p {
      font-size: var(--fs-sm);
    }
  `,
})
export class GlassCard {
  readonly heading = input<string>();
  readonly subheading = input<string>();
  readonly variant = input<GlassVariant>('default');
  readonly padding = input<'none' | 'sm' | 'md' | 'lg'>('md');
  readonly interactive = input(false);
  /** Refraction edge. Use on a few hero surfaces only (it's the most expensive effect). */
  readonly lens = input(false);
}
