import { DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  CornerDownLeft,
  FileSearch,
  LucideAngularModule,
  LucideIconData,
  Search,
  ShieldCheck,
  Smartphone,
} from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { isApiError } from '../../core/api/api-error';
import { DevicesApi } from '../../core/api/devices.api';
import { AuthService } from '../../core/auth/auth.service';
import { hasAnyRole } from '../../core/auth/roles';
import { OPS_NAV } from './ops-nav';

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  icon: LucideIconData;
  run: () => Promise<void> | void;
}

const TRACKING = /^CL-\d{4}-\d{6}$/i;
const CERTIFICATE = /^CDS-\d{4}-\d{6}$/i;
const REFERENCE = /^[A-Z0-9]{6,12}$/i;

/** Ctrl/Cmd+K: jump to a screen, or look up a device / certificate / intake reference. */
@Component({
  selector: 'command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'glass glass--strong glass--lens' },
  template: `
    <div class="search">
      <lucide-icon [img]="i.Search" [size]="20" aria-hidden="true" />
      <input
        #box
        role="combobox"
        aria-label="Search screens, tracking IDs, certificate numbers or references"
        aria-controls="palette-list"
        aria-autocomplete="list"
        [attr.aria-expanded]="items().length > 0"
        [attr.aria-activedescendant]="items()[active()] ? 'pi-' + items()[active()].id : null"
        placeholder="Go to… or type CL-2026-000123, CDS-…, SY56JDVN"
        [value]="query()"
        (input)="onInput($event)"
        (keydown)="onKey($event)"
      />
      <kbd>Esc</kbd>
    </div>
    @if (error()) {
      <p class="err" role="alert">{{ error() }}</p>
    }
    <ul id="palette-list" role="listbox" class="list">
      @for (it of items(); track it.id; let n = $index) {
        <!-- Combobox + listbox with aria-activedescendant: focus stays in the input, which handles the keys. -->
        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <li
          role="option"
          [id]="'pi-' + it.id"
          [attr.aria-selected]="n === active()"
          [class.on]="n === active()"
          (mousemove)="active.set(n)"
          (click)="choose(it)"
        >
          <lucide-icon [img]="it.icon" [size]="18" aria-hidden="true" />
          <span class="txt"
            ><span>{{ it.label }}</span
            ><small>{{ it.hint }}</small></span
          >
          @if (n === active()) {
            <lucide-icon class="enter" [img]="i.CornerDownLeft" [size]="15" aria-hidden="true" />
          }
        </li>
      } @empty {
        <li class="none" role="option" aria-selected="false" aria-disabled="true">No matches</li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
      width: min(640px, calc(100vw - 24px));
      border-radius: var(--r-xl);
      overflow: hidden;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--field-border);
    }
    .search lucide-icon {
      color: var(--text-3);
    }
    input {
      flex: 1;
      min-width: 0;
      height: 36px;
      border: 0;
      background: transparent;
      outline: none;
      font-size: var(--fs-lg);
      color: var(--text-1);
    }
    kbd {
      padding: 2px 6px;
      border-radius: 6px;
      background: var(--neutral-bg);
      font-size: 11px;
      color: var(--text-3);
    }
    .err {
      padding: 8px 18px;
      color: var(--danger);
      font-size: var(--fs-sm);
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 8px;
      max-height: min(420px, 60vh);
      overflow-y: auto;
    }
    li {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 48px;
      padding: 6px 12px;
      border-radius: var(--r-sm);
      cursor: pointer;
    }
    li.on {
      background: var(--accent-soft);
    }
    li lucide-icon {
      color: var(--accent-ink);
    }
    .txt {
      flex: 1;
      display: grid;
      font-size: var(--fs-sm);
      font-weight: 600;
    }
    .txt small {
      font-weight: 400;
      color: var(--text-3);
    }
    .enter {
      color: var(--text-3) !important;
    }
    .none {
      color: var(--text-3);
      cursor: default;
      font-size: var(--fs-sm);
    }
  `,
})
export class CommandPalette {
  private readonly ref = inject(DialogRef);
  private readonly router = inject(Router);
  private readonly devices = inject(DevicesApi);
  private readonly auth = inject(AuthService);
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  protected readonly i = { Search, CornerDownLeft };
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly error = signal<string | null>(null);

  private readonly screens = computed<PaletteItem[]>(() =>
    OPS_NAV.flatMap((g) =>
      g.items
        .filter((it) => !it.roles || hasAnyRole(this.auth.roles(), it.roles))
        .map((it) => ({
          id: it.path.replace(/\W/g, '-'),
          label: it.label,
          hint: `${g.label} · ${it.keywords ?? ''}`,
          icon: it.icon,
          run: () => this.go(it.path),
        })),
    ),
  );

  protected readonly items = computed<PaletteItem[]>(() => {
    const q = this.query().trim();
    const lookups: PaletteItem[] = [];
    if (TRACKING.test(q)) {
      lookups.push({
        id: 'dev',
        label: `Open device ${q.toUpperCase()}`,
        hint: 'GET /devices/tracking/{id}',
        icon: Smartphone,
        run: () => this.openDevice(q.toUpperCase()),
      });
    } else if (CERTIFICATE.test(q)) {
      lookups.push({
        id: 'cert',
        label: `Open certificate ${q.toUpperCase()}`,
        hint: 'Certificates',
        icon: ShieldCheck,
        run: () => this.go(`/ops/certificates/${q.toUpperCase()}`),
      });
    } else if (REFERENCE.test(q) && /\d/.test(q)) {
      lookups.push({
        id: 'ref',
        label: `Find intake request ${q.toUpperCase()}`,
        hint: 'Intake inbox by reference code',
        icon: FileSearch,
        run: () => this.go(`/ops/intake?referenceCode=${q.toUpperCase()}`),
      });
    }
    if (q.length >= 3 && !lookups.length) {
      lookups.push({
        id: 'devsearch',
        label: `Search devices for "${q}"`,
        hint: 'Tracking ID or model',
        icon: Search,
        run: () => this.go(`/ops/devices?search=${encodeURIComponent(q)}`),
      });
    }
    const needle = q.toLowerCase();
    const screens = needle
      ? this.screens().filter((s) => `${s.label} ${s.hint}`.toLowerCase().includes(needle))
      : this.screens();
    return [...lookups, ...screens];
  });

  constructor() {
    afterNextRender(() => this.box().nativeElement.focus());
  }

  protected onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.active.set(0);
    this.error.set(null);
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.items().length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.active.set((this.active() + 1) % Math.max(n, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.active.set((this.active() - 1 + n) % Math.max(n, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = this.items()[this.active()];
      if (it) void this.choose(it);
    }
  }

  protected async choose(it: PaletteItem): Promise<void> {
    await it.run();
  }

  private async go(url: string): Promise<void> {
    this.ref.close();
    await this.router.navigateByUrl(url);
  }

  private async openDevice(trackingId: string): Promise<void> {
    try {
      const device = await firstValueFrom(this.devices.byTracking(trackingId));
      await this.go(`/ops/devices/${device.id}`);
    } catch (e) {
      this.error.set(
        isApiError(e) && e.status === 404
          ? `No device with tracking ID ${trackingId}.`
          : 'Lookup failed.',
      );
    }
  }
}
