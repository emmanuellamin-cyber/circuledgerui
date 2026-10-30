import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Delete, LucideAngularModule, Phone } from 'lucide-angular';
import { KeyFeedback } from '../phone/key-feedback';
import { KeyboardMode, PhoneKeyboard } from '../phone/phone-keyboard';
import { segmentMessage } from './ussd-logic';
import { UssdSessionStore } from './ussd-session.store';

const DIAL_KEYS: readonly [string, string][] = [
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

/** Dialer → "USSD code running…" → native-style USSD dialog → final message. */
@Component({
  selector: 'ussd-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, PhoneKeyboard],
  host: { '(document:keydown)': 'onDocumentKey($event)' },
  template: `
    <div
      class="dialer"
      [class.dim]="store.screen() !== 'dialer'"
      [attr.inert]="store.screen() !== 'dialer' ? '' : null"
    >
      <div class="display" aria-live="polite">
        <p class="digits num" [class.small]="store.dialed().length > 12">
          {{ store.dialed() || ' ' }}
        </p>
        @if (!store.dialed()) {
          <button type="button" class="suggest" (click)="store.dialed.set(store.serviceCode())">
            Dial {{ store.serviceCode() }}
          </button>
        }
      </div>
      <div class="pad" role="group" aria-label="Dial pad">
        @for (k of dialKeys; track k[0]) {
          <button
            type="button"
            class="dkey"
            [class.flash]="store.flash() === k[0]"
            [attr.aria-label]="k[0]"
            (click)="press(k[0])"
          >
            <b>{{ k[0] }}</b
            ><small>{{ k[1] }}</small>
          </button>
        }
        <span></span>
        <button type="button" class="call" aria-label="Call" (click)="dial()">
          <lucide-icon [img]="icons.Phone" [size]="28" />
        </button>
        <button
          type="button"
          class="erase"
          aria-label="Delete digit"
          [class.hide]="!store.dialed()"
          (click)="erase()"
        >
          <lucide-icon [img]="icons.Delete" [size]="24" />
        </button>
      </div>
    </div>

    @switch (store.screen()) {
      @case ('running') {
        <div class="overlay">
          <div class="dialog running" role="status">
            <span class="spinner" aria-hidden="true"></span>
            <p>USSD code running…</p>
          </div>
        </div>
      }
      @case ('dialog') {
        <div class="overlay" [class.kb]="keyboardOpen()">
          <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="ussd-msg">
            <p id="ussd-msg" class="msg">{{ store.message() }}</p>
            <input
              #reply
              class="reply"
              aria-label="Reply"
              autocomplete="off"
              [attr.inputmode]="'none'"
              [value]="store.input()"
              (input)="onTyped($event)"
              (keydown)="onInputKey($event)"
              (focus)="keyboardOpen.set(true)"
              (blur)="keyboardOpen.set(false)"
            />
            <div class="actions">
              <button type="button" class="act" (click)="store.cancel()">Cancel</button>
              <button
                type="button"
                class="act strong"
                [disabled]="!store.input().trim()"
                (click)="send()"
              >
                Send
              </button>
            </div>
          </div>
        </div>
        @if (keyboardOpen()) {
          <phone-keyboard
            class="keyboard"
            [mode]="mode()"
            [flash]="store.flash()"
            (key)="typeKey($event)"
            (backspace)="store.backspace(); feedback.tick()"
            (enter)="send()"
            (modeChange)="mode.set($event)"
          />
        }
      }
      @case ('end') {
        <div class="overlay">
          <div class="dialog" role="alertdialog" aria-labelledby="ussd-end">
            <p id="ussd-end" class="msg">
              @for (s of segments(); track $index) {
                @if (s.code) {
                  <mark>{{ s.text }}</mark>
                } @else {
                  {{ s.text }}
                }
              }
            </p>
            <div class="actions">
              <button type="button" class="act strong" (click)="store.dismiss()">OK</button>
            </div>
          </div>
        </div>
      }
      @case ('error') {
        <div class="overlay">
          <div class="dialog" role="alertdialog" aria-labelledby="ussd-err">
            <p id="ussd-err" class="msg">{{ store.message() }}</p>
            <div class="actions">
              <button type="button" class="act strong" (click)="store.dismiss()">OK</button>
            </div>
          </div>
        </div>
      }
    }
  `,
  styleUrl: './ussd-screen.scss',
})
export class UssdScreen {
  protected readonly store = inject(UssdSessionStore);
  protected readonly feedback = inject(KeyFeedback);
  protected readonly icons = { Phone, Delete };
  protected readonly dialKeys = DIAL_KEYS;
  protected readonly keyboardOpen = signal(false);
  protected readonly mode = signal<KeyboardMode>('numeric');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly reply = viewChild<ElementRef<HTMLInputElement>>('reply');

  protected readonly segments = computed(() =>
    segmentMessage(this.store.message(), this.store.codes()),
  );

  constructor() {
    // Each new CON prompt: pick numeric vs QWERTY from the text and focus the reply field.
    effect(() => {
      const screen = this.store.screen();
      this.store.message();
      if (screen !== 'dialog') return;
      const wantsText = this.store.wantsText();
      untracked(() => {
        this.mode.set(wantsText ? 'qwerty' : 'numeric');
        queueMicrotask(() => this.reply()?.nativeElement.focus());
      });
    });
  }

  protected press(k: string): void {
    this.store.press(k);
    this.store.flashKey(k);
    this.feedback.tick();
  }
  protected erase(): void {
    this.store.backspace();
    this.feedback.tick();
  }
  protected dial(): void {
    this.feedback.tick('send');
    void this.store.dial();
  }
  protected send(): void {
    if (!this.store.input().trim()) return;
    this.feedback.tick('send');
    void this.store.send();
  }
  protected typeKey(k: string): void {
    this.store.press(k);
    this.feedback.tick();
  }

  protected onTyped(e: Event): void {
    this.store.input.set((e.target as HTMLInputElement).value.slice(0, 160));
  }
  protected onInputKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.send();
      return;
    }
    if (e.key.length === 1 || e.key === 'Backspace') {
      this.store.flashKey(e.key);
      this.feedback.tick();
    }
  }

  /** Physical keyboard on the dialer: digits, * and #, Backspace, Enter to call. */
  protected onDocumentKey(e: KeyboardEvent): void {
    if (this.store.screen() !== 'dialer' || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    if (
      typing ||
      !this.host.nativeElement.isConnected ||
      this.host.nativeElement.offsetParent === null
    )
      return;
    if (/^[0-9*#]$/.test(e.key)) {
      e.preventDefault();
      this.press(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      this.store.flashKey('Backspace');
      this.erase();
    } else if (e.key === 'Enter' && target?.tagName !== 'BUTTON') {
      e.preventDefault();
      this.dial();
    }
  }
}
