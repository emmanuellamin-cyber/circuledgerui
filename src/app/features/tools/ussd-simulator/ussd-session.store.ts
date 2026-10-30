import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { isApiError } from '../../../core/api/api-error';
import { toParams, v1Url } from '../../../core/api/api.service';
import { USSD_PATH, WebhooksApi, gatewayQuery } from '../../../core/api/webhooks.api';
import {
  FoundCode,
  UssdKind,
  buildCurl,
  extractCodes,
  historyText,
  isServiceCode,
  newSessionId,
  parseOptions,
  parseUssdResponse,
  suggestsText,
} from './ussd-logic';

export type UssdScreen = 'dialer' | 'running' | 'dialog' | 'end' | 'error';

export interface UssdLogEntry {
  id: number;
  at: string;
  sessionId: string;
  text: string;
  status: number | null;
  raw: string;
  kind: UssdKind | 'ERROR';
  latencyMs: number;
  curl: string;
}

/** Real USSD sessions are short-lived; the gateway drops them after about 3 minutes. */
export const SESSION_SECONDS = 180;
export const CONNECTION_PROBLEM = 'Connection problem or invalid MMI code.';

let logSeq = 0;

/**
 * One simulated handset talking to `POST /ussd/callback`. Provided per simulator page.
 * `text` is always the whole history joined by "*"; responses are shown exactly as returned.
 */
@Injectable()
export class UssdSessionStore {
  private readonly webhooks = inject(WebhooksApi);

  readonly phoneNumber = signal('+23276123456');
  readonly serviceCode = signal(environment.ussdServiceCode);
  readonly sessionId = signal(newSessionId());

  readonly screen = signal<UssdScreen>('dialer');
  /** Digits on the dialer display. */
  readonly dialed = signal('');
  /** Every reply the user sent in this session, in order. */
  readonly history = signal<readonly string[]>([]);
  /** Last message with the CON/END prefix stripped. */
  readonly message = signal('');
  readonly input = signal('');
  readonly busy = signal(false);
  readonly log = signal<readonly UssdLogEntry[]>([]);
  /** Codes from every END message this page has seen, newest first (for SMS quick replies). */
  readonly recentCodes = signal<readonly FoundCode[]>([]);
  /** Key to animate on the on-screen keypad (physical keyboard or demo script typing). */
  readonly flash = signal<string | null>(null);
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly startedAt = signal<number | null>(null);
  private readonly now = signal(Date.now());
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly remaining = computed(() => {
    const start = this.startedAt();
    if (start === null) return SESSION_SECONDS;
    return Math.max(0, SESSION_SECONDS - Math.floor((this.now() - start) / 1000));
  });
  readonly active = computed(() => this.startedAt() !== null);
  readonly options = computed(() =>
    this.screen() === 'dialog' ? parseOptions(this.message()) : [],
  );
  readonly wantsText = computed(() => this.screen() === 'dialog' && suggestsText(this.message()));
  readonly codes = computed(() => (this.screen() === 'end' ? extractCodes(this.message()) : []));
  readonly nextText = computed(() => historyText([...this.history(), this.input()]));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  /** Starts a fresh session id and returns the phone to the dialer. */
  newSession(): void {
    this.sessionId.set(newSessionId());
    this.reset();
  }

  /** Call button. Dials what's on the display, or the configured service code if it's empty. */
  async dial(): Promise<void> {
    const code = this.dialed() || this.serviceCode();
    this.dialed.set(code);
    if (!isServiceCode(code)) {
      this.fail(CONNECTION_PROBLEM);
      return;
    }
    this.serviceCode.set(code);
    this.sessionId.set(newSessionId());
    this.history.set([]);
    this.input.set('');
    this.startedAt.set(Date.now());
    this.now.set(Date.now());
    this.startTimer();
    this.screen.set('running');
    await this.hop('');
  }

  /** Send button in the USSD dialog. */
  async send(): Promise<void> {
    if (this.screen() !== 'dialog' || this.busy()) return;
    const value = this.input().trim();
    if (!value) return;
    const history = [...this.history(), value];
    this.history.set(history);
    this.input.set('');
    this.screen.set('running');
    await this.hop(historyText(history));
  }

  /** Cancel in the dialog: the handset abandons the session (no request is sent, like a phone). */
  cancel(): void {
    this.reset();
  }

  /** OK on an END / error screen. */
  dismiss(): void {
    this.reset();
    this.dialed.set('');
  }

  press(key: string): void {
    if (this.screen() === 'dialer') this.dialed.update((d) => (d + key).slice(0, 32));
    else if (this.screen() === 'dialog') this.input.update((v) => (v + key).slice(0, 160));
  }

  flashKey(key: string): void {
    this.flash.set(key);
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.flash.set(null), 160);
  }

  backspace(): void {
    if (this.screen() === 'dialer') this.dialed.update((d) => d.slice(0, -1));
    else if (this.screen() === 'dialog') this.input.update((v) => v.slice(0, -1));
  }

  private async hop(text: string): Promise<void> {
    const sessionId = this.sessionId();
    const fields = {
      sessionId,
      serviceCode: this.serviceCode(),
      phoneNumber: this.phoneNumber(),
      text,
    };
    const started = performance.now();
    this.busy.set(true);
    try {
      const raw = await firstValueFrom(this.webhooks.ussd(fields));
      if (sessionId !== this.sessionId()) return; // a newer session took over
      const reply = parseUssdResponse(raw);
      this.record(fields, 200, raw, reply.kind, started);
      this.message.set(reply.message);
      if (reply.kind === 'END') {
        this.stopTimer();
        this.startedAt.set(null);
        this.screen.set('end');
        const found = extractCodes(reply.message);
        if (found.length)
          this.recentCodes.update((old) =>
            [...found, ...old.filter((o) => !found.some((f) => f.value === o.value))].slice(0, 6),
          );
      } else {
        this.screen.set('dialog');
      }
    } catch (e) {
      if (sessionId !== this.sessionId()) return;
      const status = isApiError(e) ? e.status : null;
      const raw = isApiError(e)
        ? `${e.status} ${e.problem.title}${e.problem.detail ? `: ${e.problem.detail}` : ''}`
        : String(e);
      this.record(fields, status, raw, 'ERROR', started);
      this.fail(
        status === 429
          ? `${CONNECTION_PROBLEM}\n\nNetwork busy. Try again in a minute.`
          : CONNECTION_PROBLEM,
      );
    } finally {
      if (sessionId === this.sessionId()) this.busy.set(false);
    }
  }

  private record(
    fields: Record<string, string>,
    status: number | null,
    raw: string,
    kind: UssdLogEntry['kind'],
    started: number,
  ): void {
    const params = toParams(gatewayQuery()).toString();
    const url = new URL(
      v1Url(USSD_PATH) + (params ? `?${params}` : ''),
      location.origin,
    ).toString();
    const entry: UssdLogEntry = {
      id: ++logSeq,
      at: new Date().toISOString(),
      sessionId: fields['sessionId'],
      text: fields['text'],
      status,
      raw,
      kind,
      latencyMs: Math.round(performance.now() - started),
      curl: buildCurl(url, fields),
    };
    this.log.update((l) => [entry, ...l].slice(0, 100));
  }

  private fail(message: string): void {
    this.stopTimer();
    this.startedAt.set(null);
    this.message.set(message);
    this.screen.set('error');
  }

  private reset(): void {
    this.stopTimer();
    this.startedAt.set(null);
    this.history.set([]);
    this.input.set('');
    this.message.set('');
    this.busy.set(false);
    this.screen.set('dialer');
  }

  private startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => {
      this.now.set(Date.now());
      if (this.remaining() === 0 && this.screen() === 'dialog') {
        this.sessionId.set(newSessionId()); // drop any late response
        this.fail('USSD session timed out.');
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
