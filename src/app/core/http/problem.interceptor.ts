import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, map, throwError } from 'rxjs';
import { toApiError } from '../api/api-error';

/**
 * Converts every failed HTTP call into an `ApiError` with ProblemDetails (§3).
 * Registered OUTSIDE the auth interceptor so the auth layer still sees raw 401s.
 * Blob responses (PDF/CSV downloads) carry their JSON error as a Blob, so it is read first.
 */
export const problemInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
      if (error.error instanceof Blob) {
        return from(error.error.text()).pipe(
          map((text) => {
            throw toApiError(
              new HttpErrorResponse({
                error: text,
                headers: error.headers,
                status: error.status,
                statusText: error.statusText,
                url: error.url ?? undefined,
              }),
            );
          }),
        );
      }
      return throwError(() => toApiError(error));
    }),
  );
