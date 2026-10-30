import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Circular progress (0–100) for KPI targets. Exposed as role="img" with a full sentence. */
@Component({
  selector: 'progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'img', '[attr.aria-label]': 'ariaLabel()' },
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
      [attr.width]="size()"
      [attr.height]="size()"
    >
      <defs>
        <linearGradient [attr.id]="gid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#0a84c6" />
        </linearGradient>
      </defs>
      <circle
        class="track"
        [attr.cx]="c()"
        [attr.cy]="c()"
        [attr.r]="r()"
        [attr.stroke-width]="stroke()"
      />
      <circle
        class="bar"
        [attr.cx]="c()"
        [attr.cy]="c()"
        [attr.r]="r()"
        [attr.stroke-width]="stroke()"
        [attr.stroke]="'url(#' + gid + ')'"
        [attr.stroke-dasharray]="circumference()"
        [attr.stroke-dashoffset]="offset()"
        [attr.transform]="'rotate(-90 ' + c() + ' ' + c() + ')'"
      />
    </svg>
    <span class="value num">{{ display() }}</span>
  `,
  styles: `
    :host {
      position: relative;
      display: inline-grid;
      place-items: center;
      flex: none;
    }
    svg {
      display: block;
    }
    .track {
      fill: none;
      stroke: var(--neutral-bg);
    }
    .bar {
      fill: none;
      stroke-linecap: round;
      transition: stroke-dashoffset 900ms var(--ease-out);
    }
    .value {
      position: absolute;
      font-weight: 700;
      font-size: var(--ring-font, 0.95rem);
      letter-spacing: -0.02em;
    }
    @media (prefers-reduced-motion: reduce) {
      .bar {
        transition: none;
      }
    }
  `,
})
export class ProgressRing {
  /** Percent of target, already 0–100 from the API (§8.17: don't multiply by 100). */
  readonly value = input.required<number>();
  readonly size = input(72);
  readonly stroke = input(7);
  readonly label = input('Progress');

  private static seq = 0;
  protected readonly gid = `ring-${++ProgressRing.seq}`;
  protected readonly c = computed(() => this.size() / 2);
  protected readonly r = computed(() => (this.size() - this.stroke()) / 2);
  protected readonly circumference = computed(() => 2 * Math.PI * this.r());
  protected readonly clamped = computed(() => Math.max(0, Math.min(100, this.value())));
  protected readonly offset = computed(() => this.circumference() * (1 - this.clamped() / 100));
  protected readonly display = computed(() => `${Math.round(this.value())}%`);
  protected readonly ariaLabel = computed(() => `${this.label()}: ${this.display()} of target`);
}
