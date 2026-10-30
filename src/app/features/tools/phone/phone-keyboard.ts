import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ArrowBigUp, CornerDownLeft, Delete, LucideAngularModule } from 'lucide-angular';

export type KeyboardMode = 'numeric' | 'qwerty';

const NUMERIC: readonly [string, string][] = [
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
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/**
 * In-phone soft keyboard. Keys use pointerdown + preventDefault so the text field keeps focus.
 * `flash` highlights a key pressed on the physical keyboard.
 */
@Component({
  selector: 'phone-keyboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: {
    role: 'group',
    'aria-label': 'On-screen keyboard',
    '[class.qwerty]': "mode() === 'qwerty'",
  },
  template: `
    @if (mode() === 'numeric') {
      <div class="num-grid">
        @for (k of numeric; track k[0]) {
          <button
            type="button"
            class="key digit"
            [class.flash]="isFlash(k[0])"
            tabindex="-1"
            (pointerdown)="tap($event, k[0])"
          >
            <b>{{ k[0] }}</b
            ><small>{{ k[1] }}</small>
          </button>
        }
      </div>
      <div class="bottom">
        <button
          type="button"
          class="key fn"
          tabindex="-1"
          (pointerdown)="switch($event, 'qwerty')"
          aria-label="Letters keyboard"
        >
          ABC
        </button>
        <button
          type="button"
          class="key fn"
          tabindex="-1"
          [class.flash]="isFlash('Backspace')"
          (pointerdown)="del($event)"
          aria-label="Backspace"
        >
          <lucide-icon [img]="icons.Delete" [size]="20" />
        </button>
        <button
          type="button"
          class="key go"
          tabindex="-1"
          (pointerdown)="go($event)"
          aria-label="Enter"
        >
          <lucide-icon [img]="icons.CornerDownLeft" [size]="20" />
        </button>
      </div>
    } @else {
      @for (row of rows(); track $index; let r = $index) {
        <div class="row" [class.indent]="r === 1">
          @if (r === 2) {
            <button
              type="button"
              class="key fn wide"
              tabindex="-1"
              [class.on]="shift()"
              [attr.aria-pressed]="shift()"
              (pointerdown)="toggleShift($event)"
              aria-label="Shift"
            >
              <lucide-icon [img]="icons.ArrowBigUp" [size]="18" />
            </button>
          }
          @for (c of row; track c) {
            <button
              type="button"
              class="key ch"
              tabindex="-1"
              [class.flash]="isFlash(c)"
              (pointerdown)="tap($event, c)"
            >
              {{ c }}
            </button>
          }
          @if (r === 2) {
            <button
              type="button"
              class="key fn wide"
              tabindex="-1"
              [class.flash]="isFlash('Backspace')"
              (pointerdown)="del($event)"
              aria-label="Backspace"
            >
              <lucide-icon [img]="icons.Delete" [size]="18" />
            </button>
          }
        </div>
      }
      <div class="row">
        <button
          type="button"
          class="key fn wide"
          tabindex="-1"
          (pointerdown)="switch($event, 'numeric')"
          aria-label="Number keypad"
        >
          123
        </button>
        <button type="button" class="key fn" tabindex="-1" (pointerdown)="tap($event, '-')">
          -
        </button>
        <button
          type="button"
          class="key space"
          tabindex="-1"
          [class.flash]="isFlash(' ')"
          (pointerdown)="tap($event, ' ')"
          aria-label="Space"
        >
          space
        </button>
        <button type="button" class="key fn" tabindex="-1" (pointerdown)="tap($event, '.')">
          .
        </button>
        <button
          type="button"
          class="key go wide"
          tabindex="-1"
          (pointerdown)="go($event)"
          aria-label="Enter"
        >
          <lucide-icon [img]="icons.CornerDownLeft" [size]="18" />
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 8px;
      padding: 10px 6px 22px;
      background: rgb(30 40 44 / 0.92);
      -webkit-backdrop-filter: blur(20px);
      backdrop-filter: blur(20px);
      border-top: 1px solid rgb(255 255 255 / 0.08);
      animation: up 260ms var(--ease-out);
      user-select: none;
      touch-action: manipulation;
    }
    .key {
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 8px;
      background: rgb(255 255 255 / 0.16);
      color: #fff;
      font: inherit;
      cursor: pointer;
      box-shadow: 0 1px 0 rgb(0 0 0 / 0.4);
      transition:
        transform 90ms var(--ease-out),
        background 90ms;
      -webkit-tap-highlight-color: transparent;
    }
    .key:active,
    .key.flash {
      transform: scale(0.92);
      background: rgb(255 255 255 / 0.34);
    }
    .num-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    .digit {
      height: 48px;
      line-height: 1;
    }
    .digit b {
      font-size: 22px;
      font-weight: 450;
    }
    .digit small {
      font-size: 9px;
      letter-spacing: 0.12em;
      opacity: 0.7;
      min-height: 10px;
    }
    .bottom {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
    }
    .bottom .key {
      height: 44px;
    }
    .fn {
      background: rgb(255 255 255 / 0.08);
      font-size: 13px;
      font-weight: 600;
    }
    .fn.on {
      background: #fff;
      color: #111;
    }
    .go {
      background: #2f80ed;
    }
    .go:active {
      background: #5b9cf3;
    }
    .row {
      display: flex;
      justify-content: center;
      gap: 4px;
    }
    .row.indent {
      padding: 0 14px;
    }
    .ch {
      flex: 1;
      max-width: 32px;
      height: 42px;
      font-size: 18px;
    }
    .wide {
      flex: 1.5;
      max-width: 48px;
      height: 42px;
    }
    .space {
      flex: 5;
      height: 42px;
      font-size: 13px;
      opacity: 0.9;
    }
    .row .fn:not(.wide) {
      flex: 1;
      max-width: 32px;
      height: 42px;
    }
    @keyframes up {
      from {
        transform: translateY(100%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
  `,
})
export class PhoneKeyboard {
  readonly mode = input<KeyboardMode>('numeric');
  /** A key last pressed on the physical keyboard, to animate. */
  readonly flash = input<string | null>(null);

  readonly key = output<string>();
  readonly backspace = output<void>();
  readonly enter = output<void>();
  readonly modeChange = output<KeyboardMode>();

  protected readonly icons = { Delete, CornerDownLeft, ArrowBigUp };
  protected readonly numeric = NUMERIC;
  protected readonly shift = signal(false);
  protected readonly rows = computed(() =>
    ROWS.map((r) => (this.shift() ? r.toUpperCase() : r).split('')),
  );

  protected isFlash(k: string): boolean {
    const f = this.flash();
    return f !== null && f.toLowerCase() === k.toLowerCase();
  }

  protected tap(e: Event, k: string): void {
    e.preventDefault();
    this.key.emit(k);
    if (this.shift()) this.shift.set(false);
  }
  protected del(e: Event): void {
    e.preventDefault();
    this.backspace.emit();
  }
  protected go(e: Event): void {
    e.preventDefault();
    this.enter.emit();
  }
  protected switch(e: Event, mode: KeyboardMode): void {
    e.preventDefault();
    this.modeChange.emit(mode);
  }
  protected toggleShift(e: Event): void {
    e.preventDefault();
    this.shift.update((s) => !s);
  }
}
