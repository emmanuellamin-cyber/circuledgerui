import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import {
  Bike,
  Footprints,
  LucideAngularModule,
  Route,
  TriangleAlert,
  Wand2,
  X,
} from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { UsersApi } from '../../../core/api/admin.api';
import { DispatchApi } from '../../../core/api/dispatch.api';
import type {
  DispatchBatch,
  DispatchBatchStatus,
  GenerateBatchesResult,
  TransportMode,
} from '../../../core/api/types';
import {
  BATCH_STATUSES,
  DEVICE_CONDITION_LABELS,
  TRANSPORT_MODES,
  options,
} from '../../../core/enums/labels';
import { formatDate, formatNumber, isoDate } from '../../../core/format/format';
import { useAction } from '../../../core/state/action';
import { opt, urlQuery } from '../../../core/state/url-query';
import {
  CheckboxGroup,
  EmptyState,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassSelect,
  PageHeader,
  Paginator,
  SelectOption,
  Skeleton,
  StatusPill,
} from '../../../shared/ui';
import { withAll } from '../shared/ops-dialogs';

const tomorrow = (): string => isoDate(new Date(Date.now() + 86_400_000));

/** Dispatch planner (§8.6): generate distance-based batches, browse them, inspect pickups. */
@Component({
  selector: 'dispatch-planner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    GlassInput,
    GlassSelect,
    CheckboxGroup,
    StatusPill,
    Paginator,
    Skeleton,
    EmptyState,
  ],
  templateUrl: './dispatch-planner.html',
})
export class DispatchPlanner {
  private readonly dispatch = inject(DispatchApi);
  private readonly users = inject(UsersApi);
  protected readonly i = { Wand2, TriangleAlert, Route, X, Bike, Footprints };
  protected readonly conditionLabels = DEVICE_CONDITION_LABELS;
  protected readonly action = useAction();
  protected readonly result = signal<GenerateBatchesResult | null>(null);

  protected readonly transportOptions = withAll(options(TRANSPORT_MODES), 'Auto (from spread)');
  protected readonly statusOptions = withAll(options(BATCH_STATUSES), 'Any status');

  /** GET /users is Admin-only: an Operations Lead gets 403 and the batch goes to all active agents. */
  private readonly agentsRes = rxResource({
    stream: () =>
      this.users.list({ role: 'FieldAgent', pageSize: 100 }).pipe(catchError(() => of(null))),
  });
  protected readonly agentOptions = computed<SelectOption[]>(() =>
    (this.agentsRes.value()?.items ?? [])
      .filter((u) => u.isActive)
      .map((u) => ({ value: u.id, label: u.fullName })),
  );
  protected readonly agentsUnavailable = computed(
    () => !this.agentsRes.isLoading() && this.agentsRes.value() === null,
  );
  protected readonly agentFilterOptions = computed(() => withAll(this.agentOptions(), 'Any agent'));

  protected readonly form = new FormGroup({
    radiusKm: new FormControl('3', {
      nonNullable: true,
      validators: [Validators.min(0.1), Validators.max(50)],
    }),
    maxPerBatch: new FormControl('10', {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(50)],
    }),
    transportMode: new FormControl<TransportMode | ''>('', { nonNullable: true }),
    scheduledFor: new FormControl(tomorrow(), { nonNullable: true }),
    fieldAgentIds: new FormControl<string[]>([], { nonNullable: true }),
  });

  protected readonly q = urlQuery({ status: '', fieldAgentUserId: '', selected: '' });
  protected readonly statusFilter = new FormControl(this.q.value().status, { nonNullable: true });
  protected readonly agentFilter = new FormControl(this.q.value().fieldAgentUserId, {
    nonNullable: true,
  });
  protected readonly batches = rxResource({
    params: () => ({ ...this.q.value(), page: this.q.page() }),
    stream: ({ params: p }) =>
      this.dispatch.list({
        status: opt<DispatchBatchStatus>(p.status),
        fieldAgentUserId: p.fieldAgentUserId || undefined,
        page: p.page,
        pageSize: 10,
      }),
  });
  protected readonly selected = rxResource({
    params: () => this.q.value().selected || undefined,
    stream: ({ params: id }) => this.dispatch.get(id),
  });
  protected readonly errorText = computed(() => errorMessage(this.batches.error()));

  constructor() {
    this.statusFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.q.set({ status }));
    this.agentFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((fieldAgentUserId) => this.q.set({ fieldAgentUserId }));
  }

  async generate(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const res = await this.action.run(
      this.dispatch.generate({
        radiusKm: Number(v.radiusKm),
        maxPerBatch: Number(v.maxPerBatch),
        transportMode: v.transportMode || undefined,
        scheduledFor: v.scheduledFor || undefined,
        fieldAgentIds: v.fieldAgentIds.length ? v.fieldAgentIds : undefined,
      }),
      {
        form: this.form,
        messages: {
          no_field_agents:
            'There are no active field agents to assign batches to. An Admin can create one under Users.',
        },
      },
    );
    if (res) {
      this.result.set(res);
      this.batches.reload();
    }
  }

  protected select(b: DispatchBatch): void {
    this.q.set({ selected: b.id }, { keepPage: true });
  }
  protected close(): void {
    this.q.set({ selected: '' }, { keepPage: true });
  }
  protected collected(b: DispatchBatch): number {
    return b.pickups.filter((p) => p.status === 'Collected' || p.status === 'Received').length;
  }
  protected date(v: string): string {
    return formatDate(v);
  }
  protected km(v: number): string {
    return `${formatNumber(v, 2)} km`;
  }
}
