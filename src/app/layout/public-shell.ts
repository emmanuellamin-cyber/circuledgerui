import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ArrowRight, LogIn, LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../core/auth/auth.service';
import { BrandMark, GlassButton, GlassNav, NavLink, ThemeToggle } from '../shared/ui';
import { UserMenu } from './user-menu';

@Component({
  selector: 'public-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    GlassNav,
    BrandMark,
    GlassButton,
    ThemeToggle,
    UserMenu,
    LucideAngularModule,
  ],
  template: `
    <glass-nav [links]="links">
      <a nav-brand routerLink="/" class="brand" aria-label="CircuLedger home"
        ><brand-mark [compactOnPhone]="true"
      /></a>
      <ng-container nav-actions>
        <theme-toggle />
        @if (auth.isAuthenticated()) {
          @if (auth.primaryWorkspace(); as ws) {
            <a glass-button variant="primary" size="sm" class="ws" [routerLink]="ws.path">
              {{ ws.label }} <lucide-icon [img]="ArrowRight" [size]="16" aria-hidden="true" />
            </a>
          }
          <user-menu />
        } @else {
          <a glass-button variant="primary" class="login" routerLink="/login">
            <lucide-icon [img]="LogIn" [size]="17" aria-hidden="true" /> Log in
          </a>
        }
      </ng-container>
    </glass-nav>

    <main id="main" tabindex="-1">
      <router-outlet />
    </main>

    <footer class="footer container">
      <div class="glass glass--subtle inner">
        <div class="about">
          <brand-mark [size]="30" />
          <p class="muted">
            The web app of the Smart Youth Mobile Circularity Hub: we buy faulty phones, wipe and
            certify the data, recover parts and hazardous materials, and resell refurbished devices.
          </p>
        </div>
        <div class="cols">
          <div>
            <h3>Hub</h3>
            <ul>
              <li><a routerLink="/" fragment="how">How it works</a></li>
              <li><a routerLink="/" fragment="sell">Sell your phone</a></li>
              <li><a routerLink="/marketplace">Marketplace</a></li>
              <li><a routerLink="/verify">Verify a certificate</a></li>
            </ul>
          </div>
          <div>
            <h3>Partners</h3>
            <ul class="partners">
              <li>Njala University</li>
              <li>UNDP × Samsung Youth Mobile Circularity Innovation Challenge</li>
              <li>Sierra Leone</li>
            </ul>
          </div>
        </div>
        <p class="legal subtle">
          © {{ year }} Smart Youth Mobile Circularity Hub · Built for the pilot in Sierra Leone.
        </p>
      </div>
    </footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }
    main {
      flex: 1;
      outline: none;
    }
    .brand {
      text-decoration: none;
      border-radius: 14px;
    }
    .ws {
      display: none;
    }
    /* Narrow phones: a slimmer Log in button so the signed-out bar fits. */
    @media (max-width: 399.98px) {
      .login {
        padding-inline: var(--s-4);
      }
      .login lucide-icon {
        display: none;
      }
    }
    @media (min-width: 600px) {
      .ws {
        display: inline-flex;
      }
    }
    .footer {
      padding-block: var(--s-7) var(--s-5);
    }
    .inner {
      display: grid;
      gap: var(--s-5);
      padding: var(--s-6) var(--s-5);
      border-radius: var(--r-xl);
    }
    @media (min-width: 900px) {
      .inner {
        grid-template-columns: 1.2fr 1fr;
      }
    }
    .about {
      display: grid;
      gap: var(--s-3);
      align-content: start;
      max-width: 46ch;
    }
    .about p {
      font-size: var(--fs-sm);
    }
    .cols {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--s-5);
    }
    h3 {
      font-size: var(--fs-sm);
      margin-bottom: var(--s-2);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
      font-size: var(--fs-sm);
    }
    a {
      color: var(--text-2);
      text-decoration: none;
    }
    a:hover {
      color: var(--text-1);
      text-decoration: underline;
    }
    .partners {
      color: var(--text-2);
    }
    .legal {
      grid-column: 1 / -1;
      font-size: var(--fs-xs);
    }
  `,
})
export class PublicShell {
  protected readonly auth = inject(AuthService);
  protected readonly ArrowRight = ArrowRight;
  protected readonly LogIn = LogIn;
  protected readonly year = new Date().getFullYear();
  protected readonly links: NavLink[] = [
    { label: 'How it works', link: '/', fragment: 'how', exact: true },
    { label: 'Marketplace', link: '/marketplace' },
    { label: 'Verify a certificate', link: '/verify' },
    { label: 'Sell your phone', link: '/', fragment: 'sell', exact: true },
  ];
}
