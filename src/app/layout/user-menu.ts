import { CdkMenu, CdkMenuItem, CdkMenuItemCheckbox, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  ChevronDown,
  Contrast,
  LayoutDashboard,
  LogOut,
  LucideAngularModule,
  LucideIconData,
  ShoppingBag,
  Smartphone,
} from 'lucide-angular';
import { AuthService } from '../core/auth/auth.service';
import { ROLE_LABELS, WorkspaceId, primaryRole } from '../core/auth/roles';
import { ThemeService } from '../core/theme/theme.service';

const WORKSPACE_ICONS: Record<WorkspaceId, LucideIconData> = {
  ops: LayoutDashboard,
  mobile: Smartphone,
  marketplace: ShoppingBag,
  citizen: Smartphone,
};

/** Profile menu: who am I, workspace switcher (multi-role users), solid surfaces, sign out. */
@Component({
  selector: 'user-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuItemCheckbox, LucideAngularModule],
  template: `
    <button type="button" class="trigger" [cdkMenuTriggerFor]="menu" aria-label="Account menu">
      <span class="avatar" aria-hidden="true">{{ initials() }}</span>
      <span class="name">{{ firstName() }}</span>
      <lucide-icon [img]="ChevronDown" [size]="16" aria-hidden="true" />
    </button>

    <ng-template #menu>
      <div class="menu glass glass--strong" cdkMenu>
        <div class="who">
          <strong>{{ auth.user()?.fullName }}</strong>
          <span class="subtle">{{ auth.user()?.email }}</span>
          <span class="role">{{ roleLabel() }}</span>
        </div>
        @if (auth.workspaces().length > 0) {
          <p class="group">Workspaces</p>
          @for (w of auth.workspaces(); track w.id) {
            <button type="button" class="item" cdkMenuItem (cdkMenuItemTriggered)="go(w.path)">
              <lucide-icon [img]="icons[w.id]" [size]="18" aria-hidden="true" />
              <span class="item-text">
                <span>{{ w.label }}</span>
                <span class="subtle small">{{ w.description }}</span>
              </span>
            </button>
          }
        }
        <hr />
        <button
          type="button"
          class="item"
          cdkMenuItemCheckbox
          [cdkMenuItemChecked]="theme.solid()"
          (cdkMenuItemTriggered)="theme.solid.set(!theme.solid())"
        >
          <lucide-icon [img]="Contrast" [size]="18" aria-hidden="true" />
          <span class="item-text">Solid surfaces</span>
          <span class="check" aria-hidden="true">{{ theme.solid() ? 'On' : 'Off' }}</span>
        </button>
        <button type="button" class="item" cdkMenuItem (cdkMenuItemTriggered)="auth.logout()">
          <lucide-icon [img]="LogOut" [size]="18" aria-hidden="true" />
          <span class="item-text">Sign out</span>
        </button>
      </div>
    </ng-template>
  `,
  styles: `
    .trigger {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: var(--touch);
      padding: 0 12px 0 4px;
      border: 0;
      border-radius: var(--r-pill);
      background: var(--neutral-bg);
      color: var(--text-1);
      font-weight: 600;
      cursor: pointer;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--accent-gradient);
      color: #fff;
      font-size: 13px;
      font-weight: 700;
    }
    .name {
      display: none;
      font-size: var(--fs-sm);
    }
    @media (min-width: 600px) {
      .name {
        display: inline;
      }
    }
    .menu {
      min-width: 280px;
      padding: 8px;
      border-radius: var(--r-lg);
      margin-top: 8px;
    }
    .who {
      display: grid;
      padding: 8px 10px 12px;
      font-size: var(--fs-sm);
    }
    .role {
      justify-self: start;
      margin-top: 6px;
      padding: 2px 8px;
      border-radius: var(--r-pill);
      background: var(--accent-soft);
      color: var(--accent-ink);
      font-size: var(--fs-xs);
      font-weight: 650;
    }
    .group {
      padding: 6px 10px 4px;
      font-size: var(--fs-xs);
      font-weight: 650;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: 46px;
      padding: 6px 10px;
      border: 0;
      border-radius: var(--r-sm);
      background: transparent;
      color: var(--text-1);
      text-align: left;
      font-size: var(--fs-sm);
      font-weight: 550;
      cursor: pointer;
    }
    .item:hover,
    .item:focus {
      background: var(--neutral-bg);
      outline: none;
    }
    .item:focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: -2px;
    }
    .item-text {
      display: grid;
      flex: 1;
    }
    .small {
      font-size: var(--fs-xs);
      font-weight: 400;
    }
    .check {
      font-size: var(--fs-xs);
      color: var(--text-3);
    }
    hr {
      border: 0;
      height: 1px;
      margin: 6px 4px;
      background: var(--field-border);
    }
  `,
})
export class UserMenu {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  protected readonly icons = WORKSPACE_ICONS;
  protected readonly ChevronDown = ChevronDown;
  protected readonly LogOut = LogOut;
  protected readonly Contrast = Contrast;

  protected readonly firstName = computed(() => this.auth.user()?.fullName.split(' ')[0] ?? '');
  protected readonly initials = computed(() =>
    (this.auth.user()?.fullName ?? '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join(''),
  );
  protected readonly roleLabel = computed(() => {
    const r = primaryRole(this.auth.roles());
    return r ? ROLE_LABELS[r] : 'Signed in';
  });

  protected go(path: string): void {
    void this.router.navigateByUrl(path);
  }
}
