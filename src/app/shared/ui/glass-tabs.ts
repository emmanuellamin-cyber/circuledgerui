import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  model,
  signal,
  viewChildren,
} from '@angular/core';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';

export interface GlassTab<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIconData;
  badge?: number | string;
}

let nextId = 0;

/**
 * Segmented tabs with a sliding liquid indicator. WAI-ARIA tabs pattern: roving tabindex,
 * ←/→/Home/End. The panel element should use `[id]="tabs.panelId"` and
 * `[attr.aria-labelledby]="tabs.tabId(selected)"`.
 */
@Component({
  selector: 'glass-tabs',
  exportAs: 'glassTabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'glass glass--subtle' },
  template: `
    <div class="list" role="tablist" [attr.aria-label]="ariaLabel()">
      <span
        class="indicator"
        [style.transform]="indicatorX()"
        [style.width.px]="indicatorW()"
      ></span>
      @for (t of tabs(); track t.id) {
        <button
          #tab
          type="button"
          role="tab"
          class="tab"
          [id]="tabId(t.id)"
          [attr.aria-selected]="t.id === selected()"
          [attr.aria-controls]="panelId"
          [tabIndex]="t.id === selected() ? 0 : -1"
          (click)="select(t.id)"
          (keydown)="onKey($event)"
        >
          @if (t.icon) {
            <lucide-icon [img]="t.icon" [size]="16" aria-hidden="true" />
          }
          {{ t.label }}
          @if (t.badge !== undefined) {
            <span class="badge num">{{ t.badge }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
      padding: 4px;
      border-radius: var(--r-pill);
      max-width: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .list {
      position: relative;
      display: flex;
      gap: 2px;
    }
    .indicator {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      border-radius: var(--r-pill);
      background: var(--glass-fill-strong);
      box-shadow:
        inset 0 1px 0 var(--glass-rim),
        0 2px 10px -2px rgb(4 32 27 / 0.22);
      transition:
        transform var(--dur-3) var(--ease-spring),
        width var(--dur-3) var(--ease-spring);
    }
    .tab {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 38px;
      padding: 0 var(--s-4);
      border: 0;
      border-radius: var(--r-pill);
      background: transparent;
      color: var(--text-2);
      font-weight: 600;
      font-size: var(--fs-sm);
      white-space: nowrap;
      cursor: pointer;
      transition: color var(--dur-2);
    }
    .tab[aria-selected='true'] {
      color: var(--text-1);
    }
    .badge {
      min-width: 20px;
      padding: 0 6px;
      border-radius: var(--r-pill);
      background: var(--accent-soft);
      color: var(--accent-ink);
      font-size: 11px;
      line-height: 18px;
    }
    @media (prefers-reduced-motion: reduce) {
      .indicator {
        transition: none;
      }
    }
  `,
})
export class GlassTabs<T extends string = string> {
  readonly tabs = input.required<readonly GlassTab<T>[]>();
  readonly selected = model.required<T>();
  readonly ariaLabel = input<string>('Tabs');

  private readonly uid = `gt-${++nextId}`;
  readonly panelId = `${this.uid}-panel`;
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tab');
  protected readonly indicatorX = signal('translateX(0)');
  protected readonly indicatorW = signal(0);

  constructor() {
    afterRenderEffect(() => {
      const index = this.tabs().findIndex((t) => t.id === this.selected());
      const el = this.buttons()[index]?.nativeElement;
      if (!el) return;
      this.indicatorX.set(`translateX(${el.offsetLeft}px)`);
      this.indicatorW.set(el.offsetWidth);
    });
  }

  tabId(id: T): string {
    return `${this.uid}-${id}`;
  }

  protected select(id: T): void {
    this.selected.set(id);
  }

  protected onKey(e: KeyboardEvent): void {
    const tabs = this.tabs();
    const i = tabs.findIndex((t) => t.id === this.selected());
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    this.select(tabs[next].id);
    this.buttons()[next]?.nativeElement.focus();
  }
}
