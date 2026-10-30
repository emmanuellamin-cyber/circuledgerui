import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Download, LucideAngularModule } from 'lucide-angular';
import { DashboardApi } from '../../../core/api/admin.api';
import { useAction } from '../../../core/state/action';
import { GlassButton, GlassCard, GlassInput, PageHeader } from '../../../shared/ui';

/** Reports: CSV exports for M&E, downloaded as blobs with the auth header (§8.17, §5). */
@Component({
  selector: 'ops-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    GlassInput,
  ],
  template: `
    <page-header
      heading="Reports"
      subheading="CSV exports for monitoring and evaluation. The file name comes from the server."
    />
    <div class="two-col">
      <glass-card
        heading="KPI snapshot"
        subheading="kpis.csv · indicator, actual, target, percent_of_target"
      >
        @if (kpiAction.error(); as e) {
          <p class="form-error" role="alert">{{ e }}</p>
        }
        <button
          glass-button
          variant="primary"
          type="button"
          [loading]="kpiAction.busy()"
          (click)="downloadKpis()"
        >
          <lucide-icon [img]="Download" [size]="16" aria-hidden="true" /> Download kpis.csv
        </button>
      </glass-card>
      <glass-card
        heading="Weekly series"
        subheading="weekly.csv · week_start, devices_collected, purchase_spend_sle, orders_paid, sales_revenue_sle"
      >
        <form [formGroup]="range" class="form-grid" (ngSubmit)="downloadWeekly()">
          <glass-input label="From" type="date" formControlName="from" [optional]="true" />
          <glass-input label="To" type="date" formControlName="to" [optional]="true" />
          <p class="full subtle small">Leave empty for the last 12 weeks. Weeks start on Monday.</p>
          @if (weeklyAction.error(); as e) {
            <p class="form-error full" role="alert">{{ e }}</p>
          }
          <div class="full">
            <button glass-button variant="primary" type="submit" [loading]="weeklyAction.busy()">
              <lucide-icon [img]="Download" [size]="16" aria-hidden="true" /> Download weekly.csv
            </button>
          </div>
        </form>
      </glass-card>
    </div>
  `,
  styles: `
    .small {
      font-size: var(--fs-xs);
    }
    .form-error {
      margin-bottom: var(--s-3);
    }
  `,
})
export class OpsReports {
  private readonly dashboard = inject(DashboardApi);
  protected readonly Download = Download;
  protected readonly kpiAction = useAction();
  protected readonly weeklyAction = useAction();
  protected readonly range = new FormGroup({
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
  });

  protected async downloadKpis(): Promise<void> {
    const name = await this.kpiAction.run(() => this.dashboard.exportKpis());
    if (name) this.kpiAction.error.set(null);
  }

  protected async downloadWeekly(): Promise<void> {
    const { from, to } = this.range.getRawValue();
    if (from && to && from > to) {
      this.weeklyAction.error.set('"From" must be on or before "To".');
      return;
    }
    await this.weeklyAction.run(() =>
      this.dashboard.exportWeekly(from || undefined, to || undefined),
    );
  }
}
