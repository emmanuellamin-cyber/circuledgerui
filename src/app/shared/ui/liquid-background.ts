import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The living backdrop behind every screen: soft colour blobs drifting on transform-only
 * keyframes (GPU-composited, no repaint) plus a static SVG noise grain.
 * Stops moving under prefers-reduced-motion; fewer blobs on small screens.
 */
@Component({
  selector: 'liquid-background',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="blob b1"></div>
    <div class="blob b2"></div>
    <div class="blob b3"></div>
    <div class="blob b4"></div>
    <div class="blob b5"></div>
    <div class="grain"></div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      background: var(--bg-base);
      pointer-events: none;
      contain: strict;
    }
    .blob {
      position: absolute;
      width: 70vmax;
      height: 70vmax;
      border-radius: 50%;
      will-change: transform;
      animation: drift var(--d, 38s) var(--ease-out, ease-in-out) infinite alternate;
    }
    .b1 {
      background: radial-gradient(closest-side, var(--blob-teal), transparent);
      top: -28vmax;
      left: -18vmax;
      --d: 34s;
    }
    .b2 {
      background: radial-gradient(closest-side, var(--blob-ocean), transparent);
      top: -10vmax;
      right: -30vmax;
      --d: 42s;
      animation-name: drift-2;
    }
    .b3 {
      background: radial-gradient(closest-side, var(--blob-emerald), transparent);
      bottom: -34vmax;
      left: 5vmax;
      --d: 46s;
      animation-name: drift-3;
    }
    .b4 {
      background: radial-gradient(closest-side, var(--blob-amber), transparent);
      width: 46vmax;
      height: 46vmax;
      bottom: -6vmax;
      right: -8vmax;
      --d: 30s;
    }
    .b5 {
      background: radial-gradient(closest-side, var(--blob-mint), transparent);
      width: 40vmax;
      height: 40vmax;
      top: 30%;
      left: 34%;
      --d: 52s;
      animation-name: drift-2;
    }
    .grain {
      position: absolute;
      inset: 0;
      opacity: var(--noise-opacity);
      mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    @keyframes drift {
      0% {
        transform: translate3d(0, 0, 0) scale(1, 1) rotate(0deg);
      }
      50% {
        transform: translate3d(9vmax, 6vmax, 0) scale(1.18, 0.9) rotate(25deg);
      }
      100% {
        transform: translate3d(-4vmax, 12vmax, 0) scale(0.92, 1.12) rotate(-15deg);
      }
    }
    @keyframes drift-2 {
      0% {
        transform: translate3d(0, 0, 0) scale(1, 1);
      }
      50% {
        transform: translate3d(-12vmax, 8vmax, 0) scale(0.88, 1.15);
      }
      100% {
        transform: translate3d(-4vmax, -6vmax, 0) scale(1.12, 0.94);
      }
    }
    @keyframes drift-3 {
      0% {
        transform: translate3d(0, 0, 0) scale(1);
      }
      50% {
        transform: translate3d(14vmax, -10vmax, 0) scale(1.2, 0.86);
      }
      100% {
        transform: translate3d(22vmax, -2vmax, 0) scale(0.9, 1.1);
      }
    }
    @media (max-width: 640px) {
      .b5,
      .grain {
        display: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .blob {
        animation: none;
      }
    }
  `,
})
export class LiquidBackground {}
