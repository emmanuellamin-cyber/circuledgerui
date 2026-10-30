import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { GlassFilters, GlassToastStack, LiquidBackground } from './shared/ui';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, LiquidBackground, GlassFilters, GlassToastStack],
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <liquid-background />
    <glass-filters />
    <router-outlet />
    <glass-toast-stack />
  `,
})
export class App {
  // Instantiated here so the theme attributes stay in sync from the first render.
  protected readonly theme = inject(ThemeService);
}
