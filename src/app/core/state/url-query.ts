import { Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

export interface UrlQuery<T extends Record<string, string>> {
  /** Current values (defaults filled in). */
  readonly value: Signal<T>;
  /** Current page as a number (≥ 1). */
  readonly page: Signal<number>;
  /** Merges a patch into the URL. Filters reset the page unless `page` is in the patch. */
  set(patch: Partial<T>, opts?: { keepPage?: boolean }): void;
  setPage(page: number): void;
  reset(): void;
}

/**
 * Filters and pagination live in the URL query string (§4), so lists are shareable,
 * survive reload and work with Back. Values equal to their default are removed from the URL.
 * Must be called in an injection context.
 */
export function urlQuery<T extends Record<string, string>>(defaults: T): UrlQuery<T> {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const params = toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });

  const value = computed<T>(() => {
    const p = params();
    const out: Record<string, string> = { ...defaults };
    for (const key of Object.keys(defaults)) out[key] = p.get(key) ?? defaults[key];
    return out as T;
  });
  const page = computed(() => Math.max(1, Number(params().get('page') ?? '1') || 1));

  const navigate = (queryParams: Record<string, string | null>): void => {
    void router.navigate([], {
      relativeTo: route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  };

  return {
    value,
    page,
    set(patch, opts) {
      const q: Record<string, string | null> = opts?.keepPage ? {} : { page: null };
      for (const [k, v] of Object.entries(patch) as [string, string | undefined][]) {
        q[k] = v === undefined || v === '' || v === defaults[k] ? null : v;
      }
      navigate(q);
    },
    setPage(p) {
      navigate({ page: p <= 1 ? null : String(p) });
    },
    reset() {
      const q: Record<string, null> = { page: null };
      for (const k of Object.keys(defaults)) q[k] = null;
      navigate(q);
    },
  };
}

/** Undefined for empty strings, so they're dropped from API queries. */
export function opt<T extends string>(v: string): T | undefined {
  return v === '' ? undefined : (v as T);
}
