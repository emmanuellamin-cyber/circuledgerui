import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  Copy,
  FileSearch,
  LucideAngularModule,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Smartphone,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { IntakeApi } from '../../../core/api/intake.api';
import type { IntakeRequest } from '../../../core/api/types';
import { AuthService } from '../../../core/auth/auth.service';
import { POLICY } from '../../../core/auth/roles';
import { DEVICE_CONDITION_LABELS } from '../../../core/enums/labels';
import { SleCurrencyPipe, RelativeTimePipe } from '../../../shared/pipes';
import {
  GlassButton,
  GlassCard,
  GlassInput,
  GlassSelect,
  GlassTab,
  GlassTabs,
  ModalService,
  SelectOption,
  StatusPill,
  ToastService,
} from '../../../shared/ui';
import { VerifyDialog } from '../../public/verify-certificate/verify-dialog';
import { KeyFeedback } from '../phone/key-feedback';
import { Carrier, PhoneFrame } from '../phone/phone-frame';
import { SmsChat } from '../sms-simulator/sms-chat';
import { DemoRunner } from './demo-runner';
import { FoundCode } from './ussd-logic';
import { SESSION_SECONDS, UssdLogEntry, UssdSessionStore } from './ussd-session.store';
import { UssdScreen } from './ussd-screen';

type Channel = 'ussd' | 'sms';

/**
 * Realtime USSD + SMS simulator against the real API (§8.19).
 * Routes: /ops/tools/ussd (Ops) and /demo/ussd (public, for pitches).
 */
@Component({
  selector: 'ussd-simulator-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [UssdSessionStore, DemoRunner, KeyFeedback],
  imports: [
    ReactiveFormsModule,
    LucideAngularModule,
    GlassCard,
    GlassButton,
    GlassInput,
    GlassSelect,
    GlassTabs,
    StatusPill,
    PhoneFrame,
    UssdScreen,
    SmsChat,
    SleCurrencyPipe,
    RelativeTimePipe,
  ],
  templateUrl: './ussd-simulator-page.html',
  styleUrl: './ussd-simulator-page.scss',
})
export class UssdSimulatorPage {
  /** Route data: 'ops' or 'demo'. */
  readonly mode = input<'ops' | 'demo'>('demo');

  protected readonly store = inject(UssdSessionStore);
  protected readonly demo = inject(DemoRunner);
  protected readonly feedback = inject(KeyFeedback);
  private readonly auth = inject(AuthService);
  private readonly intake = inject(IntakeApi);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);

  protected readonly i = {
    Copy,
    FileSearch,
    Pause,
    Play,
    RotateCcw,
    ShieldCheck,
    SkipForward,
    Square,
    Volume2,
    VolumeX,
  };
  protected readonly conditionLabels = DEVICE_CONDITION_LABELS;
  protected readonly channelTabs: GlassTab<Channel>[] = [
    { id: 'ussd', label: 'USSD', icon: Smartphone },
    { id: 'sms', label: 'SMS', icon: MessageSquare },
  ];
  protected readonly channel = signal<Channel>('ussd');
  protected readonly carriers: SelectOption<Carrier>[] = [
    { value: 'Orange SL', label: 'Orange SL' },
    { value: 'Africell', label: 'Africell' },
  ];

  protected readonly phone = new FormControl(this.store.phoneNumber(), { nonNullable: true });
  protected readonly code = new FormControl(this.store.serviceCode(), { nonNullable: true });
  protected readonly carrier = new FormControl<Carrier>('Orange SL', { nonNullable: true });
  protected readonly carrierValue = signal<Carrier>('Orange SL');

  protected readonly canLookUpIntake = computed(() => this.auth.hasRole(...POLICY.Ops));
  protected readonly lookup = signal<{
    code: string;
    loading: boolean;
    result: IntakeRequest | null;
    error: string | null;
  } | null>(null);
  protected readonly expanded = signal<number | null>(null);

  protected readonly countdown = computed(() => {
    const s = this.store.remaining();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  protected readonly countdownPct = computed(
    () => (this.store.remaining() / SESSION_SECONDS) * 100,
  );
  /** Codes from the current END screen, else the most recent ones seen. */
  protected readonly found = computed<readonly FoundCode[]>(() =>
    this.store.codes().length ? this.store.codes() : this.store.recentCodes(),
  );

  constructor() {
    this.phone.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((v) => this.store.phoneNumber.set(v.trim()));
    this.code.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((v) => this.store.serviceCode.set(v.trim()));
    this.carrier.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => this.carrierValue.set(v));
  }

  protected newSession(): void {
    this.demo.stop();
    this.store.newSession();
    this.store.dialed.set('');
    this.lookup.set(null);
  }

  /** Quick-select chip: fills the reply as if typed (doesn't send). */
  protected choose(key: string): void {
    this.store.input.set(key);
    for (const ch of key) this.store.flashKey(ch);
    this.feedback.tick();
  }

  protected async copy(text: string, what = 'Copied'): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success(what);
    } catch {
      this.toast.show('Copy failed. Select the text and copy it manually.', 'warning');
    }
  }

  protected async lookUp(code: string): Promise<void> {
    this.lookup.set({ code, loading: true, result: null, error: null });
    try {
      const page = await firstValueFrom(this.intake.list({ referenceCode: code, pageSize: 1 }));
      this.lookup.set({
        code,
        loading: false,
        result: page.items[0] ?? null,
        error: page.items.length ? null : 'No intake request with this reference.',
      });
    } catch (e) {
      this.lookup.set({ code, loading: false, result: null, error: errorMessage(e) });
    }
  }

  protected verify(no: string): void {
    this.modal.open(VerifyDialog, no);
  }

  protected toggle(entry: UssdLogEntry): void {
    this.expanded.update((id) => (id === entry.id ? null : entry.id));
  }

  protected displayText(text: string): string {
    return text === '' ? '"" (start)' : text;
  }
}
