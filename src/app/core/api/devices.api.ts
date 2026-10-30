import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type {
  Device,
  DeviceHistory,
  DeviceStatus,
  Paged,
  Purchase,
  PurchaseDeviceRequest,
  SanitizationRecord,
} from './types';
import type { UpdatePayoutRequest } from './types.extra';

export interface DeviceQuery {
  status?: DeviceStatus;
  brand?: string;
  samsungOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

/** §8.7 devices, §8.8 purchasing, §8.10 sanitization, §8.18 device history. */
@Injectable({ providedIn: 'root' })
export class DevicesApi {
  private readonly api = inject(ApiService);

  list(query: DeviceQuery = {}): Observable<Paged<Device>> {
    return this.api.get<Paged<Device>>('/devices', { query: { ...query } });
  }
  get(id: string): Observable<Device> {
    return this.api.get<Device>(`/devices/${id}`);
  }
  byTracking(trackingId: string): Observable<Device> {
    return this.api.get<Device>(`/devices/tracking/${encodeURIComponent(trackingId)}`);
  }
  history(trackingId: string): Observable<DeviceHistory> {
    return this.api.get<DeviceHistory>(`/ledger/devices/${encodeURIComponent(trackingId)}`);
  }

  purchase(id: string, body: PurchaseDeviceRequest): Observable<Purchase> {
    return this.api.post<Purchase>(`/devices/${id}/purchase`, body);
  }
  getPurchase(id: string): Observable<Purchase> {
    return this.api.get<Purchase>(`/devices/${id}/purchase`);
  }
  updatePayout(id: string, body: UpdatePayoutRequest): Observable<Purchase> {
    return this.api.put<Purchase>(`/devices/${id}/purchase/payout`, body);
  }

  sanitizations(id: string): Observable<SanitizationRecord[]> {
    return this.api.get<SanitizationRecord[]>(`/devices/${id}/sanitizations`);
  }
}
