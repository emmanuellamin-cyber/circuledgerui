import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { Chart as ChartJs } from 'chart.js';
import { ThemeService } from '../../core/theme/theme.service';

export interface ChartPoint {
  label: string;
  value: number;
}

/**
 * Single-series bar or line chart (never dual-axis). Series colour validated with the dataviz
 * palette checker: light #0f8a72 on #e9f4f1, dark #21a586 on #0f2228. Chart.js is lazy-loaded.
 * Hover tooltips come from Chart.js; a visually hidden table gives the same data to
 * screen readers (and a "Show table" toggle shows it to everyone).
 */
@Component({
  selector: 'glass-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="frame" [style.height.px]="height()" [hidden]="showTable()">
      <canvas #canvas role="img" [attr.aria-label]="ariaLabel()"></canvas>
    </div>
    <table [class.sr-only]="!showTable()" class="tbl">
      <caption class="sr-only">
        {{
          ariaLabel()
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ xLabel() }}</th>
          <th scope="col">{{ yLabel() }}</th>
        </tr>
      </thead>
      <tbody>
        @for (p of points(); track p.label) {
          <tr>
            <td>{{ p.label }}</td>
            <td class="num">{{ format()(p.value) }}</td>
          </tr>
        }
      </tbody>
    </table>
    <button type="button" class="toggle" (click)="showTable.set(!showTable())">
      {{ showTable() ? 'Show chart' : 'Show table' }}
    </button>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--s-2);
    }
    .frame {
      position: relative;
    }
    .tbl {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--fs-sm);
    }
    .tbl th,
    .tbl td {
      padding: 6px 8px;
      text-align: left;
      border-bottom: 1px solid var(--field-border);
    }
    .tbl td.num {
      text-align: right;
    }
    .toggle {
      justify-self: end;
      border: 0;
      background: none;
      color: var(--accent-ink);
      font: inherit;
      font-size: var(--fs-xs);
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
    }
  `,
})
export class GlassChart {
  readonly points = input.required<readonly ChartPoint[]>();
  readonly kind = input<'bar' | 'line'>('bar');
  readonly height = input(220);
  readonly ariaLabel = input('Chart');
  readonly xLabel = input('Week');
  readonly yLabel = input('Value');
  readonly format = input<(v: number) => string>((v) => v.toLocaleString());

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly theme = inject(ThemeService);
  protected readonly showTable = signal(false);
  private chart: ChartJs | null = null;
  private readonly colors = computed(() =>
    this.theme.resolved() === 'dark'
      ? {
          series: '#21a586',
          grid: 'rgba(255,255,255,0.08)',
          text: '#98b8b1',
          tipBg: '#0f2930',
          tipFg: '#ecfbf7',
        }
      : {
          series: '#0f8a72',
          grid: 'rgba(4,32,27,0.08)',
          text: '#3d5c57',
          tipBg: '#ffffff',
          tipFg: '#04201b',
        },
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
    afterRenderEffect(async () => {
      const pts = this.points();
      const kind = this.kind();
      const c = this.colors();
      const fmt = this.format();
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.chart?.destroy();
      this.chart = new Chart(this.canvas().nativeElement, {
        type: kind,
        data: {
          labels: pts.map((p) => p.label),
          datasets: [
            {
              data: pts.map((p) => p.value),
              backgroundColor: c.series,
              borderColor: c.series,
              borderWidth: kind === 'line' ? 2 : 0,
              borderRadius: { topLeft: 4, topRight: 4 },
              borderSkipped: 'bottom',
              pointRadius: kind === 'line' ? 4 : 0,
              pointHoverRadius: 6,
              tension: 0.3,
              maxBarThickness: 28,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: reduced ? false : { duration: 500 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: c.tipBg,
              titleColor: c.tipFg,
              bodyColor: c.tipFg,
              borderColor: c.grid,
              borderWidth: 1,
              padding: 10,
              displayColors: false,
              callbacks: { label: (ctx) => fmt(Number(ctx.parsed.y)) },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: c.text, maxRotation: 0, autoSkipPadding: 12 },
              border: { display: false },
            },
            y: {
              beginAtZero: true,
              grid: { color: c.grid },
              border: { display: false },
              ticks: { color: c.text, precision: 0, callback: (v) => fmt(Number(v)) },
            },
          },
        },
      });
    });
  }
}
