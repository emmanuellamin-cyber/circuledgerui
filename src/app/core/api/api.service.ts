import { HttpClient, HttpContext, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { publicContext } from './api-context';

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

const PREFIX = '/api/v1';

export interface RequestOptions {
  query?: Query;
  /** `false` = public endpoint: no bearer token, no refresh on 401. */
  auth?: boolean;
}

/** Absolute URL for an unversioned path (`/health`) or a relative `/api/v1/...` URL from the API. */
export function apiUrl(path: string): string {
  return `${environment.apiBase}${path}`;
}

/** URL for a versioned endpoint: `/devices` → `{base}/api/v1/devices`. */
export function v1Url(path: string): string {
  return `${environment.apiBase}${PREFIX}${path}`;
}

/** Drops undefined / null / "" values like the §12 client does. */
export function toParams(query: Query = {}): HttpParams {
  let params = new HttpParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
  }
  return params;
}

/** File name from `Content-Disposition` (§5). */
export function fileNameFrom(disposition: string | null, fallback = 'download'): string {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(disposition ?? '');
  return match ? decodeURIComponent(match[1]) : fallback;
}

function context(opts: RequestOptions): HttpContext | undefined {
  return opts.auth === false ? publicContext() : undefined;
}

/**
 * Typed wrapper around HttpClient for `/api/v1`. Bearer tokens, single-flight refresh and
 * ProblemDetails mapping live in the interceptors under `core/http`.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, opts: RequestOptions = {}): Observable<T> {
    return this.http.get<T>(v1Url(path), { params: toParams(opts.query), context: context(opts) });
  }

  post<T>(path: string, body: unknown = null, opts: RequestOptions = {}): Observable<T> {
    return this.http.post<T>(v1Url(path), body, {
      params: toParams(opts.query),
      context: context(opts),
    });
  }

  put<T>(path: string, body: unknown = null, opts: RequestOptions = {}): Observable<T> {
    return this.http.put<T>(v1Url(path), body, {
      params: toParams(opts.query),
      context: context(opts),
    });
  }

  delete<T = void>(path: string, opts: RequestOptions = {}): Observable<T> {
    return this.http.delete<T>(v1Url(path), {
      params: toParams(opts.query),
      context: context(opts),
    });
  }

  /** `application/x-www-form-urlencoded` POST returning plain text (USSD webhook, §8.19). */
  postFormText(
    path: string,
    form: Record<string, string>,
    opts: RequestOptions = {},
  ): Observable<string> {
    return this.http.post(v1Url(path), new URLSearchParams(form).toString(), {
      params: toParams(opts.query),
      context: context(opts),
      responseType: 'text',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  /** `application/x-www-form-urlencoded` POST returning JSON (SMS webhook, §8.19). */
  postForm<T>(
    path: string,
    form: Record<string, string>,
    opts: RequestOptions = {},
  ): Observable<T> {
    return this.http.post<T>(v1Url(path), new URLSearchParams(form).toString(), {
      params: toParams(opts.query),
      context: context(opts),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  /** A protected file as a blob, sent with the auth header (§5). */
  blob(path: string, query?: Query): Observable<HttpResponse<Blob>> {
    return this.http.get(v1Url(path), {
      params: toParams(query),
      responseType: 'blob',
      observe: 'response',
    });
  }

  /** Downloads a protected file (PDF / PNG / CSV) and triggers a browser save. */
  async download(path: string, query?: Query): Promise<string> {
    const res = await firstValueFrom(this.blob(path, query));
    const name = fileNameFrom(res.headers.get('Content-Disposition'));
    const url = URL.createObjectURL(res.body ?? new Blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return name;
  }

  /** Object URL for a protected image (staff listing photos, QR). The caller must revoke it. */
  async objectUrl(path: string): Promise<string> {
    const res = await firstValueFrom(this.blob(path));
    return URL.createObjectURL(res.body ?? new Blob());
  }
}
