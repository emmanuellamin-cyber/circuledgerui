import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';
import { LiquidDirective } from './liquid.directive';
import { ProgressRing } from './progress-ring';

/**
 * KPI tile. Plain value, or value + progress ring when `percent` (0–100) is given.
 * `caption` is the line under the value (e.g. "of 500 target").
 */
@Component({
  selector: 'stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ProgressRing],
  hostDirectives: [LiquidDirective],
  host: { class: 'glass', '[class.glass--subtle]': 'subtle()' },
  template: `
    <div class="text">
      <p class="label">
        @if (icon(); as ic) {
          <lucide-icon [img]="ic" [size]="16" aria-hidden="true" />
        }
        {{ label() }}
      </p>
      <p class="value num">{{ value() }}</p>
      @if (caption()) {
        <p class="caption">{{ caption() }}</p>
      }
    </div>
    @if (percent() !== undefined) {
      <progress-ring [value]="percent()!" [size]="64" [stroke]="6" [label]="label()" />
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--s-3);
      padding: var(--s-4) var(--s-5);
      border-radius: var(--r-lg);
      min-width: 0;
    }
    .text {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--fs-sm);
      font-weight: 600;
      color: var(--text-2);
    }
    .label lucide-icon {
      color: var(--accent-ink);
    }
    .value {
      font-size: var(--fs-2xl);
      font-weight: 750;
      letter-spacing: -0.03em;
      line-height: 1.15;
    }
    .caption {
      font-size: var(--fs-xs);
      color: var(--text-3);
    }
  `,
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly caption = input<string>();
  readonly icon = input<LucideIconData>();
  readonly percent = input<number>();
  readonly subtle = input(false);
}
