import { HttpErrorResponse } from '@angular/common/http';
import type { ProblemDetails } from './types';

/** Port of the §12 `ApiError`. Every failed API call surfaces as one of these. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDetails,
  ) {
    super(problem.detail ?? problem.title ?? `HTTP ${status}`);
    this.name = 'ApiError';
  }

  /** Branch on this, never on the message text (§3). */
  get code(): string | undefined {
    return this.problem.code;
  }

  get fieldErrors(): Record<string, string[]> {
    return this.problem.errors ?? {};
  }

  get traceId(): string | undefined {
    return this.problem.traceId;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

function parseBody(body: unknown): Partial<ProblemDetails> | null {
  if (typeof body === 'string' && body.trim().startsWith('{')) {
    try {
      return JSON.parse(body) as Partial<ProblemDetails>;
    } catch {
      return null;
    }
  }
  return typeof body === 'object' && body !== null ? (body as Partial<ProblemDetails>) : null;
}

/** Turns an `HttpErrorResponse` into an `ApiError` carrying RFC 7807 ProblemDetails. */
export function toApiError(res: HttpErrorResponse): ApiError {
  if (res.status === 0) {
    return new ApiError(0, {
      title: 'Network error',
      status: 0,
      detail: 'Could not reach the CircuLedger API. Check your connection and try again.',
      code: 'network_error',
    });
  }
  const base: ProblemDetails = {
    title: res.statusText || `HTTP ${res.status}`,
    status: res.status,
  };
  if (res.status === 429) {
    base.detail = 'Too many requests. Please wait a moment and try again.';
  } else if (res.status === 502 || res.status === 503 || res.status === 504) {
    base.detail = 'The CircuLedger API is unavailable right now. Please try again shortly.';
  } else if (res.status >= 500) {
    base.detail = 'The server had a problem. Please try again.';
  }
  const parsed = parseBody(res.error);
  const problem: ProblemDetails = parsed ? { ...base, ...parsed, status: res.status } : base;
  return new ApiError(res.status, problem);
}

/** A short, human message for any thrown value. */
export function errorMessage(e: unknown, fallback = 'Something went wrong.'): string {
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}
