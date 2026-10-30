import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';

export interface MapPin {
  lat: number;
  lng: number;
  title: string;
  /** Plain-text lines for the popup (escaped). */
  lines?: string[];
  /** Pin colour variant. */
  tone?: 'accent' | 'done' | 'warn';
}

const LEAFLET_CSS = 'vendor/leaflet/leaflet.css';

function ensureLeafletCss(): void {
  if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) return;
  document.head.appendChild(
    Object.assign(document.createElement('link'), { rel: 'stylesheet', href: LEAFLET_CSS }),
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * OpenStreetMap with glass pins. Leaflet and its CSS load only when a map is rendered.
 * Pins update in place when the input changes.
 */
@Component({
  selector: 'glass-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #host
      class="map"
      role="region"
      [attr.aria-label]="ariaLabel()"
      [style.height]="height()"
    ></div>
    @if (failed()) {
      <p class="form-error">The map couldn't load. The list has every location.</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .map {
      border-radius: var(--r-lg);
      overflow: hidden;
      background: var(--glass-fill-nested);
    }
    :host ::ng-deep .cl-pin {
      width: 30px;
      height: 30px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: linear-gradient(135deg, #10b981, #0a5f8f);
      border: 3px solid #fff;
      box-shadow: 0 6px 14px -4px rgb(0 0 0 / 0.45);
    }
    :host ::ng-deep .cl-pin.done {
      background: #64748b;
    }
    :host ::ng-deep .cl-pin.warn {
      background: linear-gradient(135deg, #f59e0b, #ea7a0c);
    }
    :host ::ng-deep .leaflet-popup-content-wrapper {
      border-radius: 14px;
    }
  `,
})
export class GlassMap {
  readonly pins = input.required<readonly MapPin[]>();
  readonly ariaLabel = input('Map');
  readonly height = input('min(460px, 70vh)');

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  protected readonly failed = signal(false);
  private map: LeafletMap | null = null;
  private layer: LayerGroup | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.map?.remove());
    afterRenderEffect(async () => {
      const pins = this.pins();
      try {
        ensureLeafletCss();
        // Leaflet ships as CommonJS: depending on interop the API is on the namespace or `default`.
        const mod = await import('leaflet');
        const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
        if (!this.map) {
          this.map = L.map(this.host().nativeElement, { scrollWheelZoom: false });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }).addTo(this.map);
          this.layer = L.layerGroup().addTo(this.map);
        }
        this.layer!.clearLayers();
        for (const p of pins) {
          const icon = L.divIcon({
            className: '',
            html: `<div class="cl-pin ${p.tone ?? ''}"></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -28],
          });
          const body = [
            `<strong>${escapeHtml(p.title)}</strong>`,
            ...(p.lines ?? []).map(escapeHtml),
          ].join('<br>');
          L.marker([p.lat, p.lng], { icon, title: p.title, keyboard: true })
            .addTo(this.layer!)
            .bindPopup(body);
        }
        if (pins.length) {
          this.map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), {
            padding: [40, 40],
            maxZoom: 14,
          });
        } else {
          this.map.setView([8.46, -11.78], 7); // Sierra Leone
        }
      } catch {
        this.failed.set(true);
      }
    });
  }
}
