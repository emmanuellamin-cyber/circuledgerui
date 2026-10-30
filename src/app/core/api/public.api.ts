import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { publicContext } from './api-context';
import { isApiError } from './api-error';
import { ApiService, apiUrl } from './api.service';
import type {
  DeviceCondition,
  DropOffPoint,
  Listing,
  ListingSearchQuery,
  Paged,
  PriceQuote,
  PublicCertificateVerification,
} from './types';
import type { HealthReport, SigningKey } from './types.extra';

/** §8.3 Public (no login) and §8.20 health. */
@Injectable({ providedIn: 'root' })
export class PublicApi {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  /**
   * 200 (Valid / Revoked / Invalid) or 404 (NotFound). Both carry the verification body,
   * so a 404 is a result here, not an error.
   */
  verifyCertificate(certificateNumber: string): Observable<PublicCertificateVerification> {
    const no = certificateNumber.trim().toUpperCase();
    return this.api
      .get<PublicCertificateVerification>(`/public/certificates/${encodeURIComponent(no)}/verify`, {
        auth: false,
      })
      .pipe(
        catchError((e: unknown) => {
          if (isApiError(e) && e.status === 404) {
            const body = e.problem as unknown as Partial<PublicCertificateVerification>;
            return of<PublicCertificateVerification>({
              certificateNumber: body.certificateNumber ?? no,
              isValid: false,
              status: 'NotFound',
              issuedAt: body.issuedAt ?? null,
              issuer: body.issuer ?? null,
              device: body.device ?? null,
              maskedImei: body.maskedImei ?? null,
              method: body.method ?? null,
              passes: body.passes ?? null,
              payloadHash: body.payloadHash ?? null,
              reason: body.reason ?? null,
            });
          }
          return throwError(() => e);
        }),
      );
  }

  signingKey(): Observable<SigningKey> {
    return this.api.get<SigningKey>('/public/certificates/signing-key', { auth: false });
  }

  dropOffPoints(): Observable<DropOffPoint[]> {
    return this.api.get<DropOffPoint[]>('/public/drop-off-points', { auth: false });
  }

  quote(brand: string, condition: DeviceCondition): Observable<PriceQuote> {
    return this.api.get<PriceQuote>('/public/pricing/quote', {
      auth: false,
      query: { brand, condition },
    });
  }

  listings(query: ListingSearchQuery = {}): Observable<Paged<Listing>> {
    return this.api.get<Paged<Listing>>('/public/listings', { auth: false, query: { ...query } });
  }

  listing(id: string): Observable<Listing> {
    return this.api.get<Listing>(`/public/listings/${id}`, { auth: false });
  }

  /** Public photo URLs are relative (`/api/v1/public/...`): prefix the base and use directly (§5). */
  photoSrc(relativeUrl: string): string {
    return apiUrl(relativeUrl);
  }

  /** Unversioned. Returns HTTP 503 with the same body when Unhealthy. */
  health(): Observable<HealthReport> {
    return this.http.get<HealthReport>(apiUrl('/health'), { context: publicContext() }).pipe(
      catchError((e: unknown) => {
        if (isApiError(e) && e.status === 503 && 'checks' in e.problem) {
          return of(e.problem as unknown as HealthReport);
        }
        return throwError(() => e);
      }),
    );
  }
}
