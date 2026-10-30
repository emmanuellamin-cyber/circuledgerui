import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'cl.theme';
const SOLID_KEY = 'cl.solid';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // private mode: preference just isn't remembered
  }
}

/**
 * Light / dark / system theme and the "solid surfaces" (reduced transparency) switch.
 * The same attributes are set by an inline script in index.html before first paint.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly media = this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly preference = signal<ThemePreference>((read(THEME_KEY) as ThemePreference) ?? 'system');
  readonly solid = signal(read(SOLID_KEY) === '1');
  readonly resolved = computed<'light' | 'dark'>(() => {
    const p = this.preference();
    return p === 'system' ? (this.systemDark() ? 'dark' : 'light') : p;
  });

  constructor() {
    this.media?.addEventListener('change', (e) => this.systemDark.set(e.matches));
    effect(() => {
      const root = this.doc.documentElement;
      const pref = this.preference();
      if (pref === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', pref);
      root.style.colorScheme = this.resolved();
      write(THEME_KEY, pref === 'system' ? null : pref);
    });
    effect(() => {
      const solid = this.solid();
      this.doc.documentElement.toggleAttribute('data-solid', solid);
      write(SOLID_KEY, solid ? '1' : null);
    });
  }

  /** Cycles system → light → dark. */
  cycle(): void {
    const order: ThemePreference[] = ['system', 'light', 'dark'];
    this.preference.set(order[(order.indexOf(this.preference()) + 1) % order.length]);
  }
}
