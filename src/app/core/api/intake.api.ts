import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type {
  CreateIntakeRequest,
  Device,
  FulfilmentMethod,
  IntakeChannel,
  IntakeRequest,
  IntakeStatus,
  Paged,
  ReceiveIntakeRequest,
  WalkInIntakeRequest,
} from './types';
import type { SetPickupLocationRequest } from './types.extra';

export interface IntakeQuery {
  status?: IntakeStatus;
  fulfilmentMethod?: FulfilmentMethod;
  channel?: IntakeChannel;
  referenceCode?: string;
  page?: number;
  pageSize?: number;
}

/** §8.5 intake requests. */
@Injectable({ providedIn: 'root' })
export class IntakeApi {
  private readonly api = inject(ApiService);

  list(query: IntakeQuery = {}): Observable<Paged<IntakeRequest>> {
    return this.api.get<Paged<IntakeRequest>>('/intake-requests', { query: { ...query } });
  }
  get(id: string): Observable<IntakeRequest> {
    return this.api.get<IntakeRequest>(`/intake-requests/${id}`);
  }
  create(body: CreateIntakeRequest): Observable<IntakeRequest> {
    return this.api.post<IntakeRequest>('/intake-requests', body);
  }
  cancel(id: string, reason: string): Observable<IntakeRequest> {
    return this.api.post<IntakeRequest>(`/intake-requests/${id}/cancel`, { reason });
  }
  reject(id: string, reason: string): Observable<IntakeRequest> {
    return this.api.post<IntakeRequest>(`/intake-requests/${id}/reject`, { reason });
  }
  receive(id: string, body: ReceiveIntakeRequest): Observable<Device> {
    return this.api.post<Device>(`/intake-requests/${id}/receive`, body);
  }
  walkIn(body: WalkInIntakeRequest): Observable<Device> {
    return this.api.post<Device>('/intake-requests/walk-in', body);
  }
  setPickupLocation(id: string, body: SetPickupLocationRequest): Observable<IntakeRequest> {
    return this.api.put<IntakeRequest>(`/intake-requests/${id}/pickup-location`, body);
  }
}
