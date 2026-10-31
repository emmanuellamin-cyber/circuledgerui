import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type {
  Certificate,
  Component as RecoveredComponent,
  ComponentStatus,
  ComponentType,
  CreateListingRequest,
  DeviceCondition,
  FundMovementRequest,
  FundTransaction,
  FundTransactionReason,
  FundType,
  FundsOverview,
  Listing,
  ListingPhoto,
  ListingSearchQuery,
  Order,
  OrderStatus,
  Paged,
  PriceQuote,
  PricingRule,
  ReinvestmentRule,
} from './types';
import type {
  CancelOrderRequest,
  CreateOrderRequest,
  PayOrderRequest,
  UpdateListingRequest,
  UpdateReinvestmentRuleRequest,
  UpsertPricingRule,
} from './types.extra';

/** §8.11 certificates. PDFs and QR codes are blob downloads (§5). */
@Injectable({ providedIn: 'root' })
export class CertificatesApi {
  private readonly api = inject(ApiService);

  list(page = 1, pageSize = 20): Observable<Paged<Certificate>> {
    return this.api.get<Paged<Certificate>>('/certificates', { query: { page, pageSize } });
  }
  get(no: string): Observable<Certificate> {
    return this.api.get<Certificate>(`/certificates/${encodeURIComponent(no)}`);
  }
  downloadPdf(no: string): Promise<string> {
    return this.api.download(`/certificates/${encodeURIComponent(no)}/pdf`);
  }
  qrObjectUrl(no: string): Promise<string> {
    return this.api.objectUrl(`/certificates/${encodeURIComponent(no)}/qr`);
  }
  downloadQr(no: string): Promise<string> {
    return this.api.download(`/certificates/${encodeURIComponent(no)}/qr`);
  }
  revoke(no: string, reason: string): Observable<Certificate> {
    return this.api.post<Certificate>(`/certificates/${encodeURIComponent(no)}/revoke`, { reason });
  }
}

/** §8.13 listings (staff). */
@Injectable({ providedIn: 'root' })
export class ListingsApi {
  private readonly api = inject(ApiService);

  list(query: ListingSearchQuery = {}): Observable<Paged<Listing>> {
    return this.api.get<Paged<Listing>>('/listings', { query: { ...query } });
  }
  get(id: string): Observable<Listing> {
    return this.api.get<Listing>(`/listings/${id}`);
  }
  create(body: CreateListingRequest): Observable<Listing> {
    return this.api.post<Listing>('/listings', body);
  }
  update(id: string, body: UpdateListingRequest): Observable<Listing> {
    return this.api.put<Listing>(`/listings/${id}`, body);
  }
  /** Field name must be `file`; the browser sets the multipart Content-Type (§5). */
  uploadPhoto(id: string, file: File): Observable<ListingPhoto> {
    const form = new FormData();
    form.append('file', file);
    return this.api.post<ListingPhoto>(`/listings/${id}/photos`, form);
  }
  verifyPhoto(id: string, photoId: string): Observable<ListingPhoto> {
    return this.api.post<ListingPhoto>(`/listings/${id}/photos/${photoId}/verify`);
  }
  photoObjectUrl(id: string, photoId: string): Promise<string> {
    return this.api.objectUrl(`/listings/${id}/photos/${photoId}`);
  }
  publish(id: string): Observable<Listing> {
    return this.api.post<Listing>(`/listings/${id}/publish`);
  }
  withdraw(id: string): Observable<Listing> {
    return this.api.post<Listing>(`/listings/${id}/withdraw`);
  }
}

/** §8.14 orders. */
@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly api = inject(ApiService);

  list(
    query: { status?: OrderStatus; page?: number; pageSize?: number } = {},
  ): Observable<Paged<Order>> {
    return this.api.get<Paged<Order>>('/orders', { query: { ...query } });
  }
  mine(
    query: { status?: OrderStatus; page?: number; pageSize?: number } = {},
  ): Observable<Paged<Order>> {
    return this.api.get<Paged<Order>>('/orders/mine', { query: { ...query } });
  }
  get(id: string): Observable<Order> {
    return this.api.get<Order>(`/orders/${id}`);
  }
  create(body: CreateOrderRequest): Observable<Order> {
    return this.api.post<Order>('/orders', body);
  }
  pay(id: string, body: PayOrderRequest): Observable<Order> {
    return this.api.post<Order>(`/orders/${id}/pay`, body);
  }
  fulfil(id: string): Observable<Order> {
    return this.api.post<Order>(`/orders/${id}/fulfil`);
  }
  /** Pending only. 400 `errors.Reason`, 403 not the buyer, 422 no longer Pending. */
  cancel(id: string, reason: string): Observable<Order> {
    const body: CancelOrderRequest = { reason };
    return this.api.post<Order>(`/orders/${id}/cancel`, body);
  }
}

/** §8.15 funds and reinvestment. */
@Injectable({ providedIn: 'root' })
export class FundsApi {
  private readonly api = inject(ApiService);

  overview(
    query: {
      fund?: FundType;
      reason?: FundTransactionReason;
      page?: number;
      pageSize?: number;
    } = {},
  ): Observable<FundsOverview> {
    return this.api.get<FundsOverview>('/funds', { query: { ...query } });
  }
  move(body: FundMovementRequest): Observable<FundTransaction> {
    return this.api.post<FundTransaction>('/funds/movements', body);
  }
  rule(): Observable<ReinvestmentRule> {
    return this.api.get<ReinvestmentRule>('/reinvestment-rule');
  }
  ruleHistory(): Observable<ReinvestmentRule[]> {
    return this.api.get<ReinvestmentRule[]>('/reinvestment-rule/history');
  }
  updateRule(body: UpdateReinvestmentRuleRequest): Observable<ReinvestmentRule> {
    return this.api.put<ReinvestmentRule>('/reinvestment-rule', body);
  }
}

/** §8.9 pricing matrix. */
@Injectable({ providedIn: 'root' })
export class PricingApi {
  private readonly api = inject(ApiService);

  matrix(): Observable<PricingRule[]> {
    return this.api.get<PricingRule[]>('/pricing/matrix');
  }
  upsert(body: UpsertPricingRule): Observable<PricingRule> {
    return this.api.put<PricingRule>('/pricing/matrix', body);
  }
  quote(brand: string, condition: DeviceCondition): Observable<PriceQuote> {
    return this.api.get<PriceQuote>('/public/pricing/quote', {
      auth: false,
      query: { brand, condition },
    });
  }
}

/** §8.12 recovered components (for listing parts). */
@Injectable({ providedIn: 'root' })
export class ComponentsApi {
  private readonly api = inject(ApiService);

  list(
    query: {
      type?: ComponentType;
      status?: ComponentStatus;
      page?: number;
      pageSize?: number;
    } = {},
  ): Observable<Paged<RecoveredComponent>> {
    return this.api.get<Paged<RecoveredComponent>>('/recovery/components', { query: { ...query } });
  }
}
