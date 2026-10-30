import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideAngularModule, Moon, Sun, SunMoon } from 'lucide-angular';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <button
      type="button"
      class="btn"
      [attr.aria-label]="label()"
      [title]="label()"
      (click)="theme.cycle()"
    >
      <lucide-icon [img]="icon()" [size]="19" />
    </button>
  `,
  styles: `
    .btn {
      display: grid;
      place-items: center;
      width: var(--touch);
      height: var(--touch);
      border: 0;
      border-radius: var(--r-pill);
      background: var(--neutral-bg);
      color: var(--text-1);
      cursor: pointer;
      transition: transform var(--dur-2) var(--ease-spring);
    }
    .btn:active {
      transform: scale(0.92);
    }
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  protected readonly icon = computed(() => {
    const p = this.theme.preference();
    return p === 'light' ? Sun : p === 'dark' ? Moon : SunMoon;
  });
  protected readonly label = computed(() => {
    const p = this.theme.preference();
    const next = p === 'system' ? 'light' : p === 'light' ? 'dark' : 'system';
    return `Theme: ${p}. Switch to ${next}`;
  });
}
