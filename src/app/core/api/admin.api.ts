import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type {
  AwarenessCampaign,
  CreateUserRequest,
  DashboardKpis,
  DropOffPoint,
  EmploymentRecord,
  HazardousMaterialLog,
  HazardousSummary,
  LedgerEntry,
  LedgerEventType,
  LedgerVerification,
  Paged,
  Role,
  TimeSeriesPoint,
  TraineeEnrollment,
  TrainingCycle,
  UpsertDropOffPoint,
  UserProfile,
} from './types';
import type {
  CreateEmploymentRequest,
  CreateEnrollmentRequest,
  CreateTrainingCycleRequest,
  UpdateEnrollmentRequest,
} from './types.extra';

/** §8.17 dashboard and reports. */
@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly api = inject(ApiService);

  kpis(): Observable<DashboardKpis> {
    return this.api.get<DashboardKpis>('/dashboard/kpis');
  }
  intakeSeries(from?: string, to?: string): Observable<TimeSeriesPoint[]> {
    return this.api.get<TimeSeriesPoint[]>('/dashboard/time-series/intake', {
      query: { from, to },
    });
  }
  salesSeries(from?: string, to?: string): Observable<TimeSeriesPoint[]> {
    return this.api.get<TimeSeriesPoint[]>('/dashboard/time-series/sales', { query: { from, to } });
  }
  exportKpis(): Promise<string> {
    return this.api.download('/dashboard/export/kpis.csv');
  }
  exportWeekly(from?: string, to?: string): Promise<string> {
    return this.api.download('/dashboard/export/weekly.csv', { from, to });
  }
}

/** §8.18 traceability ledger. */
@Injectable({ providedIn: 'root' })
export class LedgerApi {
  private readonly api = inject(ApiService);

  list(
    query: {
      entityType?: string;
      eventType?: LedgerEventType;
      page?: number;
      pageSize?: number;
    } = {},
  ): Observable<Paged<LedgerEntry>> {
    return this.api.get<Paged<LedgerEntry>>('/ledger', { query: { ...query } });
  }
  /** Expensive: on demand or once per page load, never in a loop. */
  verify(): Observable<LedgerVerification> {
    return this.api.get<LedgerVerification>('/ledger/verify');
  }
}

/** §8.2 users (Admin). */
@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly api = inject(ApiService);

  list(
    query: { role?: Role; search?: string; page?: number; pageSize?: number } = {},
  ): Observable<Paged<UserProfile>> {
    return this.api.get<Paged<UserProfile>>('/users', { query: { ...query } });
  }
  create(body: CreateUserRequest): Observable<UserProfile> {
    return this.api.post<UserProfile>('/users', body);
  }
  setRoles(id: string, roles: Role[]): Observable<UserProfile> {
    return this.api.put<UserProfile>(`/users/${id}/roles`, { roles });
  }
  setActive(id: string, value: boolean): Observable<UserProfile> {
    return this.api.put<UserProfile>(`/users/${id}/active`, null, { query: { value } });
  }
}

/** §8.4 drop-off points (staff). */
@Injectable({ providedIn: 'root' })
export class DropOffApi {
  private readonly api = inject(ApiService);

  list(includeInactive = false): Observable<DropOffPoint[]> {
    return this.api.get<DropOffPoint[]>('/drop-off-points', { query: { includeInactive } });
  }
  create(body: UpsertDropOffPoint): Observable<DropOffPoint> {
    return this.api.post<DropOffPoint>('/drop-off-points', body);
  }
  update(id: string, body: UpsertDropOffPoint): Observable<DropOffPoint> {
    return this.api.put<DropOffPoint>(`/drop-off-points/${id}`, body);
  }
  remove(id: string): Observable<void> {
    return this.api.delete(`/drop-off-points/${id}`);
  }
}

/** §8.16 training, employment, awareness. */
@Injectable({ providedIn: 'root' })
export class PeopleApi {
  private readonly api = inject(ApiService);

  cycles(): Observable<TrainingCycle[]> {
    return this.api.get<TrainingCycle[]>('/training/cycles');
  }
  createCycle(body: CreateTrainingCycleRequest): Observable<TrainingCycle> {
    return this.api.post<TrainingCycle>('/training/cycles', body);
  }
  enrollments(cycleId: string): Observable<TraineeEnrollment[]> {
    return this.api.get<TraineeEnrollment[]>(`/training/cycles/${cycleId}/enrollments`);
  }
  enroll(cycleId: string, body: CreateEnrollmentRequest): Observable<TraineeEnrollment> {
    return this.api.post<TraineeEnrollment>(`/training/cycles/${cycleId}/enrollments`, body);
  }
  updateEnrollment(id: string, body: UpdateEnrollmentRequest): Observable<TraineeEnrollment> {
    return this.api.put<TraineeEnrollment>(`/training/enrollments/${id}`, body);
  }
  employment(): Observable<EmploymentRecord[]> {
    return this.api.get<EmploymentRecord[]>('/employment');
  }
  createEmployment(body: CreateEmploymentRequest): Observable<EmploymentRecord> {
    return this.api.post<EmploymentRecord>('/employment', body);
  }
  campaigns(): Observable<AwarenessCampaign[]> {
    return this.api.get<AwarenessCampaign[]>('/awareness-campaigns');
  }
  createCampaign(body: Omit<AwarenessCampaign, 'id'>): Observable<AwarenessCampaign> {
    return this.api.post<AwarenessCampaign>('/awareness-campaigns', body);
  }
}

/** §8.12 hazardous materials. */
@Injectable({ providedIn: 'root' })
export class HazardousApi {
  private readonly api = inject(ApiService);

  list(page = 1, pageSize = 20): Observable<Paged<HazardousMaterialLog>> {
    return this.api.get<Paged<HazardousMaterialLog>>('/recovery/hazardous-materials', {
      query: { page, pageSize },
    });
  }
  summary(): Observable<HazardousSummary> {
    return this.api.get<HazardousSummary>('/recovery/hazardous-materials/summary');
  }
}
