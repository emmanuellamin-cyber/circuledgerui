import {
  DestroyRef,
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { BatteryFull, LucideAngularModule, Phone, Signal } from 'lucide-angular';

const KEYS: readonly [string, string][] = [
  ['1', ''],
  ['2', 'ABC'],
  ['3', 'DEF'],
  ['4', 'GHI'],
  ['5', 'JKL'],
  ['6', 'MNO'],
  ['7', 'PQRS'],
  ['8', 'TUV'],
  ['9', 'WXYZ'],
  ['*', ''],
  ['0', '+'],
  ['#', ''],
];

/**
 * Decorative floating phone that "types" the USSD service code. It never shows menu text:
 * real menus only come from the API (USSD simulator).
 */
@Component({
  selector: 'hero-phone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: {
    role: 'img',
    '[attr.aria-label]': "'Phone dialling ' + code() + ' to sell a phone by USSD'",
  },
  template: `
    <div class="phone glass glass--lens" aria-hidden="true">
      <div class="island"></div>
      <div class="status">
        <span class="num">{{ clock() }}</span>
        <span class="net"
          >Orange SL <lucide-icon [img]="icons.Signal" [size]="13" />
          <lucide-icon [img]="icons.BatteryFull" [size]="15"
        /></span>
      </div>
      <div class="screen">
        <p class="hint">Dial to sell your phone</p>
        <p class="code num">{{ typed() }}<span class="caret"></span></p>
        <div class="pad">
          @for (k of keys; track k[0]) {
            <span class="key" [class.hit]="k[0] === lastKey()">
              <b>{{ k[0] }}</b
              ><small>{{ k[1] }}</small>
            </span>
          }
        </div>
        <span class="call"><lucide-icon [img]="icons.Phone" [size]="22" /></span>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      perspective: 1400px;
    }
    .phone {
      width: min(300px, 78vw);
      aspect-ratio: 9 / 18.5;
      margin-inline: auto;
      padding: 14px;
      border-radius: 46px;
      animation: float 7s ease-in-out infinite;
      transform: rotateY(-10deg) rotateX(4deg);
    }
    .island {
      width: 92px;
      height: 26px;
      margin: 2px auto 0;
      border-radius: 20px;
      background: #050b0d;
    }
    .status {
      display: flex;
      justify-content: space-between;
      padding: 8px 14px 0;
      font-size: 12px;
      font-weight: 650;
      color: var(--text-1);
    }
    .net {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .screen {
      display: grid;
      justify-items: center;
      gap: 10px;
      padding: 22px 8px 6px;
    }
    .hint {
      font-size: 12px;
      color: var(--text-2);
      font-weight: 600;
    }
    .code {
      min-height: 44px;
      font-size: clamp(1.5rem, 6vw, 1.9rem);
      font-weight: 650;
      letter-spacing: 0.02em;
      color: var(--text-1);
    }
    .caret {
      display: inline-block;
      width: 2px;
      height: 1.1em;
      margin-left: 2px;
      vertical-align: -0.15em;
      background: var(--accent-ink);
      animation: blink 1s steps(1) infinite;
    }
    .pad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px 18px;
      margin-top: 6px;
    }
    .key {
      display: grid;
      place-items: center;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: var(--glass-fill-nested);
      box-shadow: inset 0 0 0 1px var(--glass-rim);
      transition:
        transform 160ms var(--ease-spring),
        background 160ms;
      line-height: 1;
    }
    .key b {
      font-size: 1.35rem;
      font-weight: 500;
      color: var(--text-1);
    }
    .key small {
      font-size: 8px;
      letter-spacing: 0.14em;
      color: var(--text-3);
      min-height: 9px;
    }
    .key.hit {
      transform: scale(0.9);
      background: var(--accent-soft);
    }
    .call {
      display: grid;
      place-items: center;
      width: 60px;
      height: 60px;
      margin-top: 8px;
      border-radius: 50%;
      color: #fff;
      background: linear-gradient(135deg, #22c55e, #15803d);
      box-shadow: 0 8px 20px -6px rgb(21 128 61 / 0.6);
    }
    @keyframes float {
      0%,
      100% {
        transform: rotateY(-10deg) rotateX(4deg) translateY(0);
      }
      50% {
        transform: rotateY(-6deg) rotateX(2deg) translateY(-14px);
      }
    }
    @keyframes blink {
      50% {
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .phone,
      .caret {
        animation: none;
      }
    }
    @media (max-width: 380px) {
      .key {
        width: 50px;
        height: 50px;
      }
    }
  `,
})
export class HeroPhone {
  readonly code = input('*384*1234#');

  protected readonly icons = { Phone, Signal, BatteryFull };
  protected readonly keys = KEYS;
  protected readonly typed = signal('');
  protected readonly lastKey = signal<string | null>(null);
  protected readonly clock = signal(this.time());

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const clockTimer = setInterval(() => this.clock.set(this.time()), 15_000);
      if (reduced) {
        this.typed.set(this.code());
        destroyRef.onDestroy(() => clearInterval(clockTimer));
        return;
      }
      let i = 0;
      const typeTimer = setInterval(() => {
        const code = this.code();
        if (i < code.length) {
          this.lastKey.set(code[i]);
          this.typed.set(code.slice(0, ++i));
        } else if (i < code.length + 8) {
          this.lastKey.set(null);
          i++;
        } else {
          i = 0;
          this.typed.set('');
        }
      }, 260);
      destroyRef.onDestroy(() => {
        clearInterval(typeTimer);
        clearInterval(clockTimer);
      });
    });
  }

  private time(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
