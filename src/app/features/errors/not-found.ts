import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Compass, LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { GlassButton, GlassCard } from '../../shared/ui';

@Component({
  selector: 'not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, GlassCard, GlassButton],
  template: `
    <section class="container wrap">
      <glass-card variant="strong" padding="lg" class="card" [lens]="true">
        <span class="badge" aria-hidden="true"><lucide-icon [img]="Compass" [size]="34" /></span>
        <p class="eyebrow">Error 404</p>
        <h1>We couldn't find that page</h1>
        <p class="muted">The link may be old or mistyped. Here are some places to go instead.</p>
        <div class="row actions">
          <a glass-button variant="primary" routerLink="/">Home</a>
          @if (auth.primaryWorkspace(); as ws) {
            <a glass-button [routerLink]="ws.path">{{ ws.label }}</a>
          }
          <a glass-button routerLink="/verify">Verify a certificate</a>
        </div>
      </glass-card>
    </section>
  `,
  styleUrl: './error-page.scss',
})
export class NotFound {
  protected readonly auth = inject(AuthService);
  protected readonly Compass = Compass;
}
