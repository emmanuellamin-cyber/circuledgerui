import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_AUTH } from '../api/api-context';
import { AuthService } from '../auth/auth.service';

export function isApiRequest(url: string): boolean {
  return url.startsWith(`${environment.apiBase}/api/`);
}

function withToken<T>(req: HttpRequest<T>, token: string | null): HttpRequest<T> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

function is401(e: unknown): e is HttpErrorResponse {
  return e instanceof HttpErrorResponse && e.status === 401;
}

/**
 * Attaches `Authorization: Bearer` and, on 401, refreshes ONCE (shared single-flight promise),
 * replaces both tokens and retries the original request (§2 rules 2 and 3).
 *
 * If the token was already rotated by another request while this one was in flight, it retries
 * with the new token instead of refreshing again.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url) || req.context.get(SKIP_AUTH)) return next(req);

  const auth = inject(AuthService);
  const sentToken = auth.accessToken();

  return next(withToken(req, sentToken)).pipe(
    catchError((error: unknown) => {
      if (!is401(error)) return throwError(() => error);

      const current = auth.accessToken();
      const ready$ = current && current !== sentToken ? of(true) : from(auth.refreshOnce());

      return ready$.pipe(
        switchMap((ok) => {
          if (!ok) {
            auth.sessionExpired();
            return throwError(() => error);
          }
          return next(withToken(req, auth.accessToken())).pipe(
            catchError((retryError: unknown) => {
              if (is401(retryError)) auth.sessionExpired();
              return throwError(() => retryError);
            }),
          );
        }),
      );
    }),
  );
};
