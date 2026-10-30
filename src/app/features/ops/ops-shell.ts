import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, firstValueFrom, map } from 'rxjs';
import {
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LucideAngularModule,
  Menu,
  Search,
  X,
} from 'lucide-angular';
import { PublicApi } from '../../core/api/public.api';
import type { HealthStatus } from '../../core/api/types.extra';
import { AuthService } from '../../core/auth/auth.service';
import { hasAnyRole } from '../../core/auth/roles';
import { UserMenu } from '../../layout/user-menu';
import { BrandMark, ThemeToggle } from '../../shared/ui';
import { BreadcrumbService } from './breadcrumb.service';
import { CommandPalette } from './command-palette';
import { OPS_NAV, activeNav } from './ops-nav';

const COLLAPSE_KEY = 'cl.ops.collapsed';

/** Operations workspace: collapsible glass sidebar, breadcrumbs, health dot, Ctrl/Cmd+K. */
@Component({
  selector: 'ops-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideAngularModule,
    BrandMark,
    ThemeToggle,
    UserMenu,
  ],
  host: { '(document:keydown)': 'onKey($event)', '[class.collapsed]': 'collapsed()' },
  templateUrl: './ops-shell.html',
  styleUrl: './ops-shell.scss',
})
export class OpsShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly publicApi = inject(PublicApi);
  protected readonly crumbs = inject(BreadcrumbService);

  protected readonly i = { ChevronRight, ChevronsLeft, ChevronsRight, Menu, Search, X };
  protected readonly collapsed = signal(this.readCollapsed());
  protected readonly drawerOpen = signal(false);
  protected readonly health = signal<HealthStatus | 'Unknown'>('Unknown');
  protected readonly isMac = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '');

  protected readonly groups = computed(() =>
    OPS_NAV.map((g) => ({
      ...g,
      items: g.items.filter((it) => !it.roles || hasAnyRole(this.auth.roles(), it.roles)),
    })).filter((g) => g.items.length),
  );

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly current = computed(() => activeNav(this.url()));

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Close the mobile drawer on navigation.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.drawerOpen.set(false));
    afterNextRender(() => {
      void this.checkHealth();
      // Not a tight loop: once a minute, and only while the tab is visible.
      const t = setInterval(
        () => document.visibilityState === 'visible' && void this.checkHealth(),
        60_000,
      );
      destroyRef.onDestroy(() => clearInterval(t));
    });
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((c) => !c);
    try {
      localStorage.setItem(COLLAPSE_KEY, this.collapsed() ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  protected openPalette(): void {
    if (this.dialog.openDialogs.some((d) => d.componentInstance instanceof CommandPalette)) return;
    this.dialog.open(CommandPalette, {
      backdropClass: 'cl-modal-backdrop',
      panelClass: 'cl-palette-panel',
      ariaLabel: 'Command palette',
      autoFocus: false,
      restoreFocus: true,
      positionStrategy: this.overlay.position().global().top('12vh').centerHorizontally(),
    });
  }

  protected onKey(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.openPalette();
    }
  }

  private async checkHealth(): Promise<void> {
    try {
      const h = await firstValueFrom(this.publicApi.health());
      this.health.set(h.status);
    } catch {
      this.health.set('Unhealthy');
    }
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
