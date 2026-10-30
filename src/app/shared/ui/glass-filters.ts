import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';

/**
 * SVG filter used by `.glass--lens` (feTurbulence + feDisplacementMap) for the refraction edge.
 *
 * Only Chromium supports `url()` inside `backdrop-filter`; Safari and Firefox would drop the whole
 * declaration, so the class `fx-lens` is added to <html> only on Chromium with a fine pointer
 * (desktop). Phones keep the cheaper plain blur to hold 60 fps.
 */
@Component({
  selector: 'glass-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg width="0" height="0" focusable="false">
      <filter
        id="cl-lens"
        x="0"
        y="0"
        width="100%"
        height="100%"
        color-interpolation-filters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.008 0.012"
          numOctaves="2"
          seed="7"
          result="noise"
        />
        <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="soft"
          scale="38"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  `,
  styles: `
    :host {
      position: absolute;
      width: 0;
      height: 0;
      overflow: hidden;
    }
  `,
})
export class GlassFilters {
  constructor() {
    const doc = inject(DOCUMENT);
    afterNextRender(() => {
      const win = doc.defaultView;
      if (!win) return;
      const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } })
        .userAgentData?.brands;
      const chromium = brands?.some((b) => /Chromium/i.test(b.brand)) ?? false;
      const finePointer = win.matchMedia('(pointer: fine)').matches;
      const reduced = win.matchMedia('(prefers-reduced-transparency: reduce)').matches;
      doc.documentElement.classList.toggle('fx-lens', chromium && finePointer && !reduced);
    });
  }
}
