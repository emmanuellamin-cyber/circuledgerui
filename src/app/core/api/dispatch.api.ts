import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type {
  DispatchBatch,
  DispatchBatchStatus,
  GenerateBatchesRequest,
  GenerateBatchesResult,
  Paged,
} from './types';

export interface BatchQuery {
  status?: DispatchBatchStatus;
  fieldAgentUserId?: string;
  page?: number;
  pageSize?: number;
}

/** §8.6 dispatch (pickup batches). */
@Injectable({ providedIn: 'root' })
export class DispatchApi {
  private readonly api = inject(ApiService);

  generate(body: GenerateBatchesRequest): Observable<GenerateBatchesResult> {
    return this.api.post<GenerateBatchesResult>('/dispatch/batches/generate', body);
  }
  list(query: BatchQuery = {}): Observable<Paged<DispatchBatch>> {
    return this.api.get<Paged<DispatchBatch>>('/dispatch/batches', { query: { ...query } });
  }
  get(id: string): Observable<DispatchBatch> {
    return this.api.get<DispatchBatch>(`/dispatch/batches/${id}`);
  }
}
