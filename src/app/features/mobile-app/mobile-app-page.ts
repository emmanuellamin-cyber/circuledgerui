import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, MapPin, ScanLine, Smartphone, Wrench } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE_LABELS, hasAnyRole } from '../../core/auth/roles';
import { GlassButton, GlassCard } from '../../shared/ui';

/**
 * Workshop (Technician) and Field (FieldAgent) moved to the CircuLedger mobile app
 * (Flutter project `circuledger_mobile`). Technicians and field agents land here on the web.
 */
@Component({
  selector: 'mobile-app-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, GlassCard, GlassButton],
  template: `
    <section class="container section">
      <div class="section-head">
        <p class="eyebrow">CircuLedger mobile app</p>
        <h1>{{ heading() }}</h1>
        <p>
          The Workshop and Field tools run in the CircuLedger app for Android and iPhone, built for
          the bench and the road: camera scanning, GPS and one-tap calls. Sign in with the same
          account you use here.
        </p>
      </div>

      <div class="grid">
        <glass-card heading="Workshop" subheading="For technicians at the hub">
          <ul class="list">
            <li>
              <lucide-icon [img]="i.ScanLine" [size]="18" aria-hidden="true" /> Scan tracking-ID
              labels with the camera
            </li>
            <li>
              <lucide-icon [img]="i.Wrench" [size]="18" aria-hidden="true" /> Wipe & certify,
              decide, dismantle, recover
            </li>
            <li>
              <lucide-icon [img]="i.Smartphone" [size]="18" aria-hidden="true" /> Receive phones and
              photograph listings
            </li>
          </ul>
        </glass-card>
        <glass-card heading="Field" subheading="For pickup agents">
          <ul class="list">
            <li>
              <lucide-icon [img]="i.MapPin" [size]="18" aria-hidden="true" /> My route on a map,
              batch by batch
            </li>
            <li>
              <lucide-icon [img]="i.Smartphone" [size]="18" aria-hidden="true" /> Call the seller
              and mark pickups collected
            </li>
            <li>
              <lucide-icon [img]="i.MapPin" [size]="18" aria-hidden="true" /> Fix missing pickup
              locations with GPS
            </li>
          </ul>
        </glass-card>
      </div>

      <glass-card variant="strong" class="get">
        <h2>Getting the app</h2>
        <p class="muted">
          Ask a Hub administrator for the latest CircuLedger app (Android APK or TestFlight link).
          Operations leads and administrators can use both the app and the Operations dashboard
          here.
        </p>
        <div class="row">
          @if (canUseOps()) {
            <a glass-button variant="primary" routerLink="/ops">Open Operations dashboard</a>
          }
          <a glass-button routerLink="/">Back to home</a>
        </div>
      </glass-card>
    </section>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
      gap: var(--s-4);
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--s-3);
    }
    .list li {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .list lucide-icon {
      color: var(--accent-ink);
      margin-top: 2px;
    }
    .get {
      display: grid;
      gap: var(--s-3);
      margin-top: var(--s-4);
    }
    .get h2 {
      font-size: var(--fs-xl);
    }
  `,
})
export class MobileAppPage {
  private readonly auth = inject(AuthService);
  protected readonly i = { ScanLine, Wrench, Smartphone, MapPin };
  protected readonly canUseOps = computed(() => this.auth.hasRole('Admin', 'OperationsLead'));
  protected readonly heading = computed(() => {
    const roles = this.auth.roles();
    const staff = roles.filter((r) => r === 'Technician' || r === 'FieldAgent');
    return this.auth.isAuthenticated() && hasAnyRole(roles, staff)
      ? `Your ${staff.map((r) => ROLE_LABELS[r].toLowerCase()).join(' and ')} tools are in the app`
      : 'Workshop and Field are in the mobile app';
  });
}
