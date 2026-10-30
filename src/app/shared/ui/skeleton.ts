import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Loading placeholder. Hidden from assistive tech: put `aria-busy="true"` on the region
 * that is loading instead.
 */
@Component({
  selector: 'skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @for (line of lineArray(); track $index) {
      <span
        class="bone"
        [style.width]="$last && lines() > 1 ? '62%' : width()"
        [style.height]="height()"
        [style.border-radius]="circle() ? '50%' : radius()"
      ></span>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 8px;
    }
    .bone {
      display: block;
      background:
        linear-gradient(100deg, transparent 20%, var(--skeleton-shine) 50%, transparent 80%) 0 0 /
          200% 100%,
        var(--skeleton);
      animation: shine 1.4s linear infinite;
    }
    @keyframes shine {
      to {
        background-position:
          -200% 0,
          0 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bone {
        animation: none;
      }
    }
  `,
})
export class Skeleton {
  readonly width = input('100%');
  readonly height = input('14px');
  readonly radius = input('8px');
  readonly lines = input(1);
  readonly circle = input(false);
  protected readonly lineArray = computed(() => Array.from({ length: this.lines() }));
}
