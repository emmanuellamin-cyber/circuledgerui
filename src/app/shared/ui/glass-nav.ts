import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule, Menu, X } from 'lucide-angular';

export interface NavLink {
  label: string;
  link: string;
  fragment?: string;
  exact?: boolean;
}

/**
 * Floating glass top bar: brand slot, links, actions slot. Below 900px the links collapse into
 * a sheet behind a menu button.
 */
@Component({
  selector: 'glass-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  template: `
    <nav class="bar glass glass--lens" [attr.aria-label]="ariaLabel()">
      <div class="brand"><ng-content select="[nav-brand]" /></div>
      <ul class="links" [class.open]="open()" [id]="'nav-links'">
        @for (l of links(); track l.label) {
          <li>
            <a
              [routerLink]="l.link"
              [fragment]="l.fragment"
              routerLinkActive="active"
              [routerLinkActiveOptions]="activeOptions(l)"
              ariaCurrentWhenActive="page"
              (click)="open.set(false)"
              >{{ l.label }}</a
            >
          </li>
        }
      </ul>
      <div class="actions">
        <ng-content select="[nav-actions]" />
        <button
          type="button"
          class="toggle"
          [attr.aria-expanded]="open()"
          aria-controls="nav-links"
          [attr.aria-label]="open() ? 'Close menu' : 'Open menu'"
          (click)="open.set(!open())"
        >
          <lucide-icon [img]="open() ? icons.X : icons.Menu" [size]="20" />
        </button>
      </div>
    </nav>
  `,
  styles: `
    :host {
      position: sticky;
      top: 0;
      z-index: var(--z-nav);
      display: block;
      padding: max(10px, env(safe-area-inset-top)) var(--gutter) 0;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: var(--s-3);
      max-width: var(--content-max);
      margin: 0 auto;
      min-height: 60px;
      padding: 8px 8px 8px 16px;
      border-radius: var(--r-pill);
    }
    .brand {
      flex: none;
      display: flex;
    }
    .links {
      display: none;
      flex: 1;
      justify-content: center;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .links a {
      display: inline-flex;
      align-items: center;
      min-height: 40px;
      padding: 0 14px;
      border-radius: var(--r-pill);
      color: var(--text-2);
      font-weight: 600;
      font-size: var(--fs-sm);
      text-decoration: none;
      transition:
        background var(--dur-2),
        color var(--dur-2);
    }
    .links a:hover {
      color: var(--text-1);
      background: var(--neutral-bg);
    }
    .links a.active {
      color: var(--text-1);
      background: var(--glass-fill-nested);
    }
    .actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: var(--s-2);
    }
    .toggle {
      display: grid;
      place-items: center;
      width: var(--touch);
      height: var(--touch);
      border: 0;
      border-radius: var(--r-pill);
      background: var(--neutral-bg);
      color: var(--text-1);
      cursor: pointer;
    }
    @media (min-width: 900px) {
      .links {
        display: flex;
      }
      .toggle {
        display: none;
      }
    }
    @media (max-width: 899.98px) {
      .links.open {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        display: grid;
        gap: 2px;
        padding: 8px;
        border-radius: var(--r-lg);
        background: var(--glass-fill-strong);
        -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
        backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
        box-shadow:
          inset 0 0 0 1px var(--glass-rim),
          var(--glass-shadow);
        animation: drop var(--dur-3) var(--ease-spring);
      }
      .links.open a {
        min-height: 48px;
        font-size: var(--fs-base);
      }
      .bar {
        position: relative;
      }
    }
    @keyframes drop {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.98);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .links.open {
        animation: none;
      }
    }
  `,
})
export class GlassNav {
  readonly links = input<readonly NavLink[]>([]);
  readonly ariaLabel = input('Main');
  protected readonly open = signal(false);
  protected readonly icons = { Menu, X };

  protected activeOptions(l: NavLink): IsActiveMatchOptions {
    return {
      paths: l.exact ? 'exact' : 'subset',
      queryParams: 'ignored',
      matrixParams: 'ignored',
      fragment: l.fragment ? 'exact' : 'ignored',
    };
  }
}
