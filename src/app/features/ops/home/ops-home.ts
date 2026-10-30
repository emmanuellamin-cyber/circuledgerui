import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  Battery,
  Briefcase,
  Coins,
  GraduationCap,
  HandCoins,
  Inbox,
  Link2,
  LucideAngularModule,
  RefreshCw,
  School,
  ShieldCheck,
  Smartphone,
  Store,
  University,
  UsersRound,
} from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { DashboardApi, LedgerApi } from '../../../core/api/admin.api';
import type { TargetMetric, TimeSeriesPoint } from '../../../core/api/types';
import { formatDate, formatNumber, formatSle } from '../../../core/format/format';
import {
  ChartPoint,
  GlassButton,
  GlassCard,
  GlassChart,
  GlassTab,
  GlassTabs,
  PageHeader,
  ProgressRing,
  Skeleton,
  StatTile,
} from '../../../shared/ui';

type IntakeMeasure = 'count' | 'value';

interface Ring {
  label: string;
  caption: string;
  percent: number;
  value: string;
  icon: typeof Smartphone;
  good?: boolean;
}

const pct = (m: TargetMetric): number => (m.target > 0 ? (m.actual / m.target) * 100 : 0);

/** Home / KPIs: GET /dashboard/kpis, time series, GET /ledger/verify (§9 A). */
@Component({
  selector: 'ops-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    GlassChart,
    GlassTabs,
    StatTile,
    ProgressRing,
    Skeleton,
  ],
  templateUrl: './ops-home.html',
  styleUrl: './ops-home.scss',
})
export class OpsHome {
  private readonly dashboard = inject(DashboardApi);
  private readonly ledger = inject(LedgerApi);
  protected readonly i = { RefreshCw, Link2, ShieldCheck, Coins, HandCoins, Store, Inbox };

  protected readonly kpis = rxResource({ stream: () => this.dashboard.kpis() });
  protected readonly intake = rxResource({ stream: () => this.dashboard.intakeSeries() });
  protected readonly sales = rxResource({ stream: () => this.dashboard.salesSeries() });
  /** Expensive hash-chain recompute: once per page load, plus the "Check again" button. */
  protected readonly integrity = rxResource({ stream: () => this.ledger.verify() });

  protected readonly intakeMeasure = signal<IntakeMeasure>('count');
  protected readonly salesMeasure = signal<IntakeMeasure>('value');
  protected readonly intakeTabs: GlassTab<IntakeMeasure>[] = [
    { id: 'count', label: 'Devices' },
    { id: 'value', label: 'Spend' },
  ];
  protected readonly salesTabs: GlassTab<IntakeMeasure>[] = [
    { id: 'value', label: 'Revenue' },
    { id: 'count', label: 'Orders' },
  ];
  protected readonly sle = (v: number): string => formatSle(v).replace('.00', '');
  protected readonly int = (v: number): string => formatNumber(v);

  protected readonly errorText = computed(() =>
    errorMessage(this.kpis.error(), 'Could not load KPIs.'),
  );

  protected readonly rings = computed<Ring[]>(() => {
    const k = this.kpis.value();
    if (!k) return [];
    return [
      {
        label: 'Devices collected',
        caption: `of ${k.devicesCollected.target}`,
        percent: pct(k.devicesCollected),
        value: formatNumber(k.devicesCollected.actual),
        icon: Smartphone,
      },
      {
        label: 'Hazardous diverted',
        caption: `of ${k.hazardousKgDiverted.target} kg`,
        percent: pct(k.hazardousKgDiverted),
        value: `${formatNumber(k.hazardousKgDiverted.actual, 1)} kg`,
        icon: Battery,
      },
      {
        label: 'Technicians trained',
        caption: `of ${k.techniciansTrained.target}`,
        percent: pct(k.techniciansTrained),
        value: formatNumber(k.techniciansTrained.actual),
        icon: GraduationCap,
      },
      {
        label: 'Jobs created',
        caption: `of ${k.jobsCreated.target}`,
        percent: pct(k.jobsCreated),
        value: formatNumber(k.jobsCreated.actual),
        icon: Briefcase,
      },
      {
        label: 'Schools reached',
        caption: `of ${k.schoolsReached.target}`,
        percent: pct(k.schoolsReached),
        value: formatNumber(k.schoolsReached.actual),
        icon: School,
      },
      {
        label: 'Campuses reached',
        caption: `of ${k.campusesReached.target}`,
        percent: pct(k.campusesReached),
        value: formatNumber(k.campusesReached.actual),
        icon: University,
      },
      {
        label: 'Women trainees',
        caption: `target ≥ ${k.womenInclusionTargetPercent}%`,
        percent:
          k.womenInclusionTargetPercent > 0
            ? (k.womenTraineesPercent / k.womenInclusionTargetPercent) * 100
            : 0,
        value: `${formatNumber(k.womenTraineesPercent, 1)}%`,
        icon: UsersRound,
        good: k.womenTraineesPercent >= k.womenInclusionTargetPercent,
      },
      {
        label: 'Women hires',
        caption: `target ≥ ${k.womenInclusionTargetPercent}%`,
        percent:
          k.womenInclusionTargetPercent > 0
            ? (k.womenHiresPercent / k.womenInclusionTargetPercent) * 100
            : 0,
        value: `${formatNumber(k.womenHiresPercent, 1)}%`,
        icon: UsersRound,
        good: k.womenHiresPercent >= k.womenInclusionTargetPercent,
      },
    ];
  });

  protected readonly intakePoints = computed(() =>
    this.toPoints(this.intake.value(), this.intakeMeasure()),
  );
  protected readonly salesPoints = computed(() =>
    this.toPoints(this.sales.value(), this.salesMeasure()),
  );

  protected money(v: number | undefined): string {
    return formatSle(v);
  }
  protected num(v: number | undefined, d = 0): string {
    return formatNumber(v, d);
  }
  protected date(v: string | undefined): string {
    return formatDate(v);
  }

  private toPoints(series: TimeSeriesPoint[] | undefined, m: IntakeMeasure): ChartPoint[] {
    return (series ?? []).map((p) => ({
      label: new Date(`${p.weekStart}T00:00:00`).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
      }),
      value: m === 'count' ? p.count : p.value,
    }));
  }
}
