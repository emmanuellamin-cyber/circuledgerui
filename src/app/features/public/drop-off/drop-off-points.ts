import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  Clock,
  ExternalLink,
  List,
  LucideAngularModule,
  Map as MapIcon,
  MapPin,
  RefreshCw,
} from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { PublicApi } from '../../../core/api/public.api';
import type { DropOffPoint } from '../../../core/api/types';
import { DROP_OFF_TYPE_LABELS } from '../../../core/enums/labels';
import {
  EmptyState,
  GlassButton,
  GlassTab,
  GlassTabs,
  LiquidDirective,
  Skeleton,
  StatusPill,
  Tone,
} from '../../../shared/ui';
import { DropOffMap } from './drop-off-map';

type View = 'list' | 'map';

const TYPE_TONES: Record<DropOffPoint['type'], Tone> = {
  Hub: 'accent',
  SolarMakit: 'warning',
  Kiosk: 'info',
};

/** `GET /public/drop-off-points` as cards, with an optional map (Leaflet + OpenStreetMap). */
@Component({
  selector: 'drop-off-points',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    GlassTabs,
    Skeleton,
    EmptyState,
    GlassButton,
    StatusPill,
    LiquidDirective,
    DropOffMap,
  ],
  template: `
    <div class="bar">
      <glass-tabs
        #viewTabs="glassTabs"
        [tabs]="tabs"
        [(selected)]="view"
        ariaLabel="Drop-off points view"
      />
      @if (points.hasValue()) {
        <p class="subtle small num">{{ count() }} active point{{ count() === 1 ? '' : 's' }}</p>
      }
    </div>

    <div
      [id]="viewTabs.panelId"
      role="tabpanel"
      [attr.aria-labelledby]="viewTabs.tabId(view())"
      [attr.aria-busy]="points.isLoading()"
    >
      @if (points.isLoading()) {
        <div class="grid">
          @for (i of [1, 2, 3]; track i) {
            <div class="card glass">
              <skeleton height="18px" width="60%" /><skeleton [lines]="2" />
            </div>
          }
        </div>
      } @else if (points.error()) {
        <div class="form-error" role="alert">
          <span>{{ errorText() }}</span>
          <button glass-button size="sm" type="button" (click)="points.reload()">
            <lucide-icon [img]="icons.RefreshCw" [size]="14" aria-hidden="true" /> Retry
          </button>
        </div>
      } @else if (count() === 0) {
        <empty-state
          heading="No drop-off points open right now"
          message="You can still sell by dialling the USSD code: an agent can pick the phone up."
          [icon]="icons.MapPin"
        />
      } @else if (view() === 'map') {
        <drop-off-map [points]="points.value() ?? []" />
      } @else {
        <ul class="grid">
          @for (p of points.value(); track p.id) {
            <li class="card glass" liquid>
              <div class="head">
                <h3>{{ p.name }}</h3>
                <status-pill
                  [status]="p.type"
                  [label]="typeLabels[p.type]"
                  [tone]="typeTones[p.type]"
                />
              </div>
              @if (p.landmark) {
                <p class="line">
                  <lucide-icon [img]="icons.MapPin" [size]="15" aria-hidden="true" />{{
                    p.landmark
                  }}
                </p>
              }
              <p class="line">
                <lucide-icon [img]="icons.Clock" [size]="15" aria-hidden="true" />{{
                  p.openingHours
                }}
              </p>
              <a class="dir" [href]="directions(p)" target="_blank" rel="noopener">
                Directions <lucide-icon [img]="icons.ExternalLink" [size]="14" aria-hidden="true" />
                <span class="sr-only">to {{ p.name }} (opens OpenStreetMap)</span>
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--s-4);
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--s-3);
    }
    .small {
      font-size: var(--fs-sm);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: var(--s-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .card {
      display: grid;
      gap: var(--s-2);
      align-content: start;
      padding: var(--s-4) var(--s-5);
      border-radius: var(--r-lg);
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--s-2);
      margin-bottom: 4px;
    }
    .line {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      font-size: var(--fs-sm);
      color: var(--text-2);
    }
    .line lucide-icon {
      margin-top: 3px;
      color: var(--accent-ink);
    }
    .dir {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      font-size: var(--fs-sm);
      font-weight: 600;
    }
    .form-error {
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }
  `,
})
export class DropOffPoints {
  private readonly api = inject(PublicApi);
  protected readonly icons = { MapPin, Clock, ExternalLink, RefreshCw };
  protected readonly typeLabels = DROP_OFF_TYPE_LABELS;
  protected readonly typeTones = TYPE_TONES;
  protected readonly tabs: GlassTab<View>[] = [
    { id: 'list', label: 'List', icon: List },
    { id: 'map', label: 'Map', icon: MapIcon },
  ];
  protected readonly view = signal<View>('list');

  protected readonly points = rxResource({ stream: () => this.api.dropOffPoints() });
  protected readonly count = computed(() => this.points.value()?.length ?? 0);
  protected readonly errorText = computed(() =>
    errorMessage(this.points.error(), 'Could not load drop-off points.'),
  );

  protected directions(p: DropOffPoint): string {
    return `https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=17/${p.latitude}/${p.longitude}`;
  }
}
