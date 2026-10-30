import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChevronLeft, LucideAngularModule, SendHorizontal } from 'lucide-angular';
import { environment } from '../../../../environments/environment';
import { errorMessage } from '../../../core/api/api-error';
import { WebhooksApi } from '../../../core/api/webhooks.api';
import { KeyFeedback } from '../phone/key-feedback';
import { PhoneKeyboard, KeyboardMode } from '../phone/phone-keyboard';
import { extractCodes, newSessionId, segmentMessage } from '../ussd-simulator/ussd-logic';
import { UssdSessionStore } from '../ussd-simulator/ussd-session.store';

interface Bubble {
  id: number;
  from: 'me' | 'hub';
  text: string;
  at: string;
  state: 'sending' | 'sent' | 'failed' | 'received';
  keyword?: string;
}

let seq = 0;

/** Messages-style chat against `POST /sms/inbound`: keywords SELL / STATUS / VERIFY (§8.19). */
@Component({
  selector: 'sms-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, PhoneKeyboard],
  template: `
    <header class="head">
      <lucide-icon [img]="icons.ChevronLeft" [size]="22" aria-hidden="true" />
      <span class="avatar" aria-hidden="true">CL</span>
      <div class="who">
        <strong>CircuLedger Hub</strong>
        <span>SMS to {{ hubNumber() }}</span>
      </div>
    </header>

    <div #scroller class="thread" role="log" aria-label="SMS conversation" aria-live="polite">
      @if (!bubbles().length) {
        <p class="hint">Try a keyword below, or type your own.</p>
      }
      @for (b of bubbles(); track b.id) {
        <div class="bubble" [class.me]="b.from === 'me'" [class.failed]="b.state === 'failed'">
          <p>
            @for (s of segmentsOf(b.text); track $index) {
              @if (s.code) {
                <mark>{{ s.text }}</mark>
              } @else {
                {{ s.text }}
              }
            }
          </p>
          <span class="meta">
            @if (b.keyword) {
              <span class="kw">{{ b.keyword }}</span>
            }
            @switch (b.state) {
              @case ('sending') {
                Sending…
              }
              @case ('failed') {
                <button type="button" class="retry" (click)="retry(b)">Not sent. Retry</button>
              }
              @default {
                {{ time(b.at) }}
              }
            }
          </span>
        </div>
      }
    </div>

    <div class="quick" role="group" aria-label="Keyword suggestions">
      @for (q of suggestions(); track q) {
        <button
          type="button"
          class="chip"
          (pointerdown)="$event.preventDefault()"
          (click)="draft.set(q); focus()"
        >
          {{ q }}
        </button>
      }
    </div>

    <form class="composer" (submit)="$event.preventDefault(); send()">
      <input
        #box
        aria-label="Message"
        placeholder="Text message"
        autocomplete="off"
        [attr.inputmode]="'none'"
        [value]="draft()"
        (input)="onDraft($event)"
        (focus)="keyboardOpen.set(true)"
        (blur)="keyboardOpen.set(false)"
        (keydown)="onKey($event)"
      />
      <button type="submit" class="send" aria-label="Send message" [disabled]="!draft().trim()">
        <lucide-icon [img]="icons.SendHorizontal" [size]="18" />
      </button>
    </form>
    @if (keyboardOpen()) {
      <phone-keyboard
        [mode]="mode()"
        [flash]="store.flash()"
        (key)="draft.set(draft() + $event); feedback.tick()"
        (backspace)="draft.set(draft().slice(0, -1)); feedback.tick()"
        (enter)="send()"
        (modeChange)="mode.set($event)"
      />
    }
  `,
  styleUrl: './sms-chat.scss',
})
export class SmsChat {
  protected readonly store = inject(UssdSessionStore);
  protected readonly feedback = inject(KeyFeedback);
  private readonly webhooks = inject(WebhooksApi);
  protected readonly icons = { ChevronLeft, SendHorizontal };

  readonly hubNumber = signal(environment.smsHubNumber);
  protected readonly bubbles = signal<readonly Bubble[]>([]);
  protected readonly draft = signal('');
  protected readonly keyboardOpen = signal(false);
  protected readonly mode = signal<KeyboardMode>('qwerty');
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');
  private readonly scroller = viewChild.required<ElementRef<HTMLDivElement>>('scroller');

  protected readonly suggestions = computed(() => {
    const codes = this.store.recentCodes();
    const ref = codes.find((c) => c.type === 'reference')?.value ?? 'SY56JDVN';
    const cert = codes.find((c) => c.type === 'certificate')?.value ?? 'CDS-2026-000045';
    return ['SELL Samsung SCREEN Kowama', `STATUS ${ref}`, `VERIFY ${cert}`, 'HELP'];
  });

  constructor() {
    afterRenderEffect(() => {
      this.bubbles();
      this.keyboardOpen();
      const el = this.scroller().nativeElement;
      el.scrollTop = el.scrollHeight;
    });
  }

  /** Also used by the demo panel. */
  async sendText(text: string): Promise<void> {
    const me: Bubble = {
      id: ++seq,
      from: 'me',
      text,
      at: new Date().toISOString(),
      state: 'sending',
    };
    this.bubbles.update((b) => [...b, me]);
    await this.deliver(me);
  }

  protected async send(): Promise<void> {
    const text = this.draft().trim();
    if (!text) return;
    this.draft.set('');
    this.feedback.tick('send');
    await this.sendText(text);
  }

  protected async retry(b: Bubble): Promise<void> {
    this.patch(b.id, { state: 'sending' });
    await this.deliver(b);
  }

  private async deliver(me: Bubble): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.webhooks.sms({
          from: this.store.phoneNumber(),
          text: me.text,
          to: this.hubNumber(),
          id: newSessionId(),
          date: new Date().toISOString(),
        }),
      );
      this.patch(me.id, { state: 'sent' });
      this.bubbles.update((b) => [
        ...b,
        {
          id: ++seq,
          from: 'hub',
          text: res.reply,
          at: new Date().toISOString(),
          state: 'received',
          keyword: res.keyword,
        },
      ]);
      const found = extractCodes(res.reply);
      if (found.length) {
        this.store.recentCodes.update((old) =>
          [...found, ...old.filter((o) => !found.some((f) => f.value === o.value))].slice(0, 6),
        );
      }
    } catch (e) {
      this.patch(me.id, { state: 'failed' });
      console.warn('[sms-simulator]', errorMessage(e));
    }
  }

  private patch(id: number, change: Partial<Bubble>): void {
    this.bubbles.update((list) => list.map((b) => (b.id === id ? { ...b, ...change } : b)));
  }

  protected focus(): void {
    this.box().nativeElement.focus();
  }

  protected onDraft(e: Event): void {
    this.draft.set((e.target as HTMLInputElement).value);
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.key.length === 1 || e.key === 'Backspace') {
      this.store.flashKey(e.key);
      this.feedback.tick();
    }
  }

  protected segmentsOf(text: string) {
    return segmentMessage(text, extractCodes(text));
  }

  protected time(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
