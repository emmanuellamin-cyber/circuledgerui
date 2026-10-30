import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { BatteryMedium, LucideAngularModule, Wifi } from 'lucide-angular';

export type Carrier = 'Orange SL' | 'Africell';

/** Glass smartphone body: dynamic island, live status bar and a screen slot. */
@Component({
  selector: 'phone-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="body glass glass--lens">
      <span class="btn vol" aria-hidden="true"></span>
      <span class="btn power" aria-hidden="true"></span>
      <div class="screen">
        <div class="status" aria-hidden="true">
          <span class="time num">{{ clock() }}</span>
          <span class="island"></span>
          <span class="right">
            <span class="carrier">{{ carrier() }}</span>
            <span class="bars">
              @for (b of [1, 2, 3, 4]; track b) {
                <i [style.height.px]="3 + b * 2" [class.off]="b > signalBars()"></i>
              }
            </span>
            <lucide-icon [img]="icons.Wifi" [size]="13" />
            <lucide-icon [img]="icons.BatteryMedium" [size]="18" />
          </span>
        </div>
        <div class="content"><ng-content /></div>
        <span class="home" aria-hidden="true"></span>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: min(380px, 100%);
      margin-inline: auto;
    }
    .body {
      position: relative;
      padding: 12px;
      border-radius: 54px;
      aspect-ratio: 9 / 19.2;
      max-height: calc(100dvh - 120px);
      min-height: 620px;
    }
    .btn {
      position: absolute;
      width: 4px;
      border-radius: 4px;
      background: var(--glass-rim);
    }
    .vol {
      left: -3px;
      top: 140px;
      height: 64px;
    }
    .power {
      right: -3px;
      top: 170px;
      height: 90px;
    }
    .screen {
      position: relative;
      height: 100%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      border-radius: 44px;
      background: var(--phone-bg, #0b1418);
      color: #f2f7f6;
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08);
      isolation: isolate;
    }
    .status {
      position: relative;
      z-index: 5;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 8px;
      height: 44px;
      padding: 0 22px;
      font-size: 13px;
      font-weight: 650;
    }
    .island {
      width: 104px;
      height: 30px;
      border-radius: 20px;
      background: #000;
    }
    .right {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 5px;
    }
    .carrier {
      font-size: 11px;
      white-space: nowrap;
    }
    .bars {
      display: inline-flex;
      align-items: flex-end;
      gap: 1.5px;
      height: 12px;
    }
    .bars i {
      width: 3px;
      border-radius: 1px;
      background: currentColor;
    }
    .bars i.off {
      opacity: 0.3;
    }
    .content {
      position: relative;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .home {
      position: absolute;
      bottom: 8px;
      left: 50%;
      width: 120px;
      height: 5px;
      translate: -50% 0;
      border-radius: 4px;
      background: rgb(255 255 255 / 0.55);
      z-index: 6;
    }
    @media (max-width: 420px) {
      .body {
        min-height: 0;
        aspect-ratio: auto;
        height: min(760px, calc(100dvh - 140px));
        padding: 8px;
        border-radius: 44px;
      }
      .screen {
        border-radius: 36px;
      }
      .carrier {
        display: none;
      }
    }
  `,
})
export class PhoneFrame {
  readonly carrier = input<Carrier>('Orange SL');
  readonly signalBars = input(4);
  protected readonly icons = { Wifi, BatteryMedium };
  protected readonly clock = signal(this.time());

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const t = setInterval(() => this.clock.set(this.time()), 10_000);
      destroyRef.onDestroy(() => clearInterval(t));
    });
  }

  private time(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
