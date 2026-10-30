import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, ShieldX } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { GlassButton, GlassCard } from '../../shared/ui';

@Component({
  selector: 'forbidden-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, GlassCard, GlassButton],
  template: `
    <section class="container wrap">
      <glass-card variant="strong" padding="lg" class="card" [lens]="true">
        <span class="badge" aria-hidden="true"><lucide-icon [img]="ShieldX" [size]="34" /></span>
        <p class="eyebrow">Error 403</p>
        <h1>This area isn't part of your role</h1>
        <p class="muted">
          @if (from()) {
            <span class="mono">{{ from() }}</span> needs a different role.
          }
          If you think you should have access, ask a Hub administrator to update your roles, then
          sign in again.
        </p>
        <div class="row actions">
          @if (auth.primaryWorkspace(); as ws) {
            <a glass-button variant="primary" [routerLink]="ws.path">Go to {{ ws.label }}</a>
          } @else {
            <a glass-button variant="primary" routerLink="/">Back to home</a>
          }
          <button glass-button type="button" (click)="switchUser()">Sign in as someone else</button>
        </div>
      </glass-card>
    </section>
  `,
  styleUrl: './error-page.scss',
})
export class Forbidden {
  readonly from = input<string>();
  protected readonly auth = inject(AuthService);
  protected readonly ShieldX = ShieldX;

  protected async switchUser(): Promise<void> {
    await this.auth.logout('/login');
  }
}
