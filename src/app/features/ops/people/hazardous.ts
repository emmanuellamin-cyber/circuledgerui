import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BatteryWarning, LucideAngularModule, TriangleAlert } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { HazardousApi } from '../../../core/api/admin.api';
import { humanize } from '../../../core/enums/labels';
import { formatDateTime, formatKg, formatNumber } from '../../../core/format/format';
import { urlQuery } from '../../../core/state/url-query';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  PageHeader,
  Paginator,
  Skeleton,
  StatTile,
} from '../../../shared/ui';

/** Hazardous materials (§8.12): summary + log, newest first. Logging happens in the workshop. */
@Component({
  selector: 'ops-hazardous',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    StatTile,
    Paginator,
    Skeleton,
    EmptyState,
  ],
  template: `
    <page-header
      heading="Hazardous materials"
      subheading="Lithium batteries, lead and other materials diverted from landfill and stored safely."
    />
    @if (summary.value(); as s) {
      <div class="kpi-grid">
        <stat-tile
          label="Total diverted"
          [value]="kg(s.totalKg)"
          caption="pilot target 50 kg"
          [percent]="(s.totalKg / 50) * 100"
          [icon]="i.TriangleAlert"
        />
        <stat-tile label="Lithium" [value]="kg(s.lithiumKg)" [subtle]="true" />
        <stat-tile label="Lead" [value]="kg(s.leadKg)" [subtle]="true" />
        <stat-tile label="Other" [value]="kg(s.otherKg)" [subtle]="true" />
        <stat-tile
          label="Swollen batteries"
          [value]="num(s.swollenBatteries)"
          caption="handled as fire risk"
          [icon]="i.BatteryWarning"
        />
      </div>
    } @else if (summary.isLoading()) {
      <div class="kpi-grid">
        @for (n of [1, 2, 3]; track n) {
          <skeleton height="92px" radius="22px" />
        }
      </div>
    }
    <glass-card padding="sm" class="block">
      @if (list.isLoading() && !list.value()) {
        <skeleton [lines]="6" height="22px" />
      } @else if (list.error()) {
        <div class="form-error" role="alert">
          {{ errorText() }}
          <button glass-button size="sm" type="button" (click)="list.reload()">Retry</button>
        </div>
      } @else if (list.value()?.items?.length) {
        <table class="data">
          <caption class="sr-only">
            Hazardous material log
          </caption>
          <thead>
            <tr>
              <th scope="col">Logged</th>
              <th scope="col">Material</th>
              <th scope="col" class="r">Weight</th>
              <th scope="col">Device</th>
              <th scope="col">Storage</th>
            </tr>
          </thead>
          <tbody>
            @for (h of list.value()!.items; track h.id) {
              <tr>
                <td data-label="Logged">{{ when(h.loggedAt) }}</td>
                <td data-label="Material">
                  {{ humanize(h.material) }}
                  @if (h.isSwollenBattery) {
                    <span class="hazard"
                      ><lucide-icon [img]="i.TriangleAlert" [size]="13" aria-hidden="true" />
                      Swollen</span
                    >
                  }
                  @if (h.description) {
                    <div class="subtle tiny">{{ h.description }}</div>
                  }
                </td>
                <td data-label="Weight" class="r num">{{ kg(h.weightKg) }}</td>
                <td data-label="Device" class="mono">
                  @if (h.deviceId) {
                    <a [routerLink]="['/ops/devices', h.deviceId]">{{ h.trackingId }}</a>
                  } @else {
                    Bulk
                  }
                </td>
                <td data-label="Storage">{{ h.storageLocation }}</td>
              </tr>
            }
          </tbody>
        </table>
        <glass-paginator
          [page]="list.value()!.page"
          [pageSize]="list.value()!.pageSize"
          [total]="list.value()!.totalCount"
          [pages]="list.value()!.totalPages"
          (pageChange)="q.setPage($event)"
        />
      } @else {
        <empty-state
          heading="Nothing logged yet"
          message="Safety-trained technicians log materials in the workshop after dismantling."
          [icon]="i.TriangleAlert"
        />
      }
    </glass-card>
  `,
  styles: `
    .block {
      margin-top: var(--s-4);
    }
    .tiny {
      font-size: var(--fs-xs);
    }
    .hazard {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-left: 6px;
      padding: 1px 8px;
      border-radius: 999px;
      background: var(--warning-bg);
      color: var(--warning);
      font-size: var(--fs-xs);
      font-weight: 700;
    }
  `,
})
export class OpsHazardous {
  private readonly api = inject(HazardousApi);
  protected readonly i = { TriangleAlert, BatteryWarning };
  protected readonly humanize = humanize;
  protected readonly q = urlQuery({});
  protected readonly summary = rxResource({ stream: () => this.api.summary() });
  protected readonly list = rxResource({
    params: () => this.q.page(),
    stream: ({ params: page }) => this.api.list(page, 20),
  });
  protected readonly errorText = computed(() => errorMessage(this.list.error()));
  protected kg(v: number): string {
    return formatKg(v);
  }
  protected num(v: number): string {
    return formatNumber(v);
  }
  protected when(v: string): string {
    return formatDateTime(v);
  }
}
