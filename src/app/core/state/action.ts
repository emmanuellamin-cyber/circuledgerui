import { WritableSignal, inject, signal } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import { firstValueFrom, Observable } from 'rxjs';
import { isApiError } from '../api/api-error';
import { applyProblemToForm } from '../api/problem-mapping';
import { ToastService } from '../../shared/ui/glass-toast';

export interface ActionOptions {
  /** Toast shown on success. */
  success?: string;
  /** Validation errors (400) are mapped onto this form; other messages go to `error`. */
  form?: FormGroup;
  /** Show errors as a toast instead of the inline `error` signal. */
  toastErrors?: boolean;
  /** Per-code friendly messages, e.g. `{ insufficient_funds: '…' }`. Default is `problem.detail`. */
  messages?: Record<string, string>;
}

export interface Action {
  readonly busy: WritableSignal<boolean>;
  readonly error: WritableSignal<string | null>;
  /** HTTP status of the last failure (0 = network), null after success. */
  readonly status: WritableSignal<number | null>;
  /** Runs `work`; resolves to the result, or `undefined` if it failed (already reported). */
  run<T>(
    work: Observable<T> | (() => Promise<T> | Observable<T>),
    opts?: ActionOptions,
  ): Promise<T | undefined>;
}

/**
 * Busy flag + ProblemDetails handling for a button or form (§3): shows `detail`, branches on
 * `code`, maps 400 field errors onto the form, toasts success. Call in an injection context.
 */
export function useAction(): Action {
  const toast = inject(ToastService);
  const busy = signal(false);
  const error = signal<string | null>(null);
  const status = signal<number | null>(null);

  return {
    busy,
    error,
    status,
    async run<T>(
      work: Observable<T> | (() => Promise<T> | Observable<T>),
      opts: ActionOptions = {},
    ) {
      busy.set(true);
      error.set(null);
      status.set(null);
      try {
        const out = typeof work === 'function' ? work() : work;
        const result = out instanceof Observable ? await firstValueFrom(out) : await out;
        if (opts.success) toast.success(opts.success);
        return result;
      } catch (e) {
        let message = e instanceof Error ? e.message : 'Something went wrong.';
        if (isApiError(e)) {
          status.set(e.status);
          if (e.code && opts.messages?.[e.code]) message = opts.messages[e.code];
          if (e.status === 400 && opts.form) {
            message = applyProblemToForm(opts.form, e).join(' ');
          }
          if (opts.toastErrors) toast.error(e);
        } else if (opts.toastErrors) {
          toast.error(e);
        }
        if (!opts.toastErrors) error.set(message || null);
        return undefined;
      } finally {
        busy.set(false);
      }
    },
  };
}
