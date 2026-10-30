import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, firstValueFrom } from 'rxjs';
import { Inbox, LucideAngularModule, MapPinOff, Plus, UserRoundPlus, X } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { DevicesApi } from '../../../core/api/devices.api';
import { IntakeApi } from '../../../core/api/intake.api';
import type {
  Device,
  FulfilmentMethod,
  IntakeChannel,
  IntakeRequest,
  IntakeStatus,
} from '../../../core/api/types';
import { AuthService } from '../../../core/auth/auth.service';
import { POLICY } from '../../../core/auth/roles';
import {
  CHANNEL_LABELS,
  DEVICE_CONDITION_LABELS,
  FULFILMENT_LABELS,
  FULFILMENT_METHODS,
  INTAKE_CHANNELS,
  INTAKE_STATUSES,
  options,
} from '../../../core/enums/labels';
import { formatDateTime, formatSle, relativeTime } from '../../../core/format/format';
import { opt, urlQuery } from '../../../core/state/url-query';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassSelect,
  ModalService,
  PageHeader,
  Paginator,
  Skeleton,
  StatusPill,
  ToastService,
} from '../../../shared/ui';
import { ReasonDialog, ReasonDialogData, ReceiveDialog, withAll } from '../shared/ops-dialogs';
import { CreateIntakeDialog, WalkInDialog } from './intake-dialogs';

/** Intake inbox (§9 A): filters in the URL, detail panel, lifecycle actions from §7. */
@Component({
  selector: 'intake-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    GlassSelect,
    GlassInput,
    StatusPill,
    Paginator,
    Skeleton,
    EmptyState,
  ],
  templateUrl: './intake-inbox.html',
})
export class IntakeInbox {
  private readonly intake = inject(IntakeApi);
  private readonly devices = inject(DevicesApi);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly i = { Plus, UserRoundPlus, X, Inbox, MapPinOff };
  protected readonly conditionLabels = DEVICE_CONDITION_LABELS;
  protected readonly channelLabels = CHANNEL_LABELS;
  protected readonly fulfilmentLabels = FULFILMENT_LABELS;
  protected readonly statusOptions = withAll(options(INTAKE_STATUSES), 'Any status');
  protected readonly methodOptions = withAll(
    options(FULFILMENT_METHODS, FULFILMENT_LABELS),
    'Drop-off or pickup',
  );
  protected readonly channelOptions = withAll(
    options(INTAKE_CHANNELS, CHANNEL_LABELS),
    'Any channel',
  );

  protected readonly q = urlQuery({
    status: '',
    fulfilmentMethod: '',
    channel: '',
    referenceCode: '',
    selected: '',
  });
  protected readonly isOps = computed(() => this.auth.hasRole(...POLICY.Ops));

  protected readonly status = new FormControl(this.q.value().status, { nonNullable: true });
  protected readonly method = new FormControl(this.q.value().fulfilmentMethod, {
    nonNullable: true,
  });
  protected readonly channel = new FormControl(this.q.value().channel, { nonNullable: true });
  protected readonly ref = new FormControl(this.q.value().referenceCode, { nonNullable: true });

  protected readonly list = rxResource({
    params: () => ({ ...this.q.value(), page: this.q.page() }),
    stream: ({ params: p }) =>
      this.intake.list({
        status: opt<IntakeStatus>(p.status),
        fulfilmentMethod: opt<FulfilmentMethod>(p.fulfilmentMethod),
        channel: opt<IntakeChannel>(p.channel),
        referenceCode: p.referenceCode.trim().toUpperCase() || undefined,
        page: p.page,
        pageSize: 20,
      }),
  });
  protected readonly selected = rxResource({
    params: () => this.q.value().selected || undefined,
    stream: ({ params: id }) => this.intake.get(id),
  });
  protected readonly errorText = computed(() =>
    errorMessage(this.list.error(), 'Could not load intake requests.'),
  );
  protected readonly filtered = computed(() => {
    const v = this.q.value();
    return !!(v.status || v.fulfilmentMethod || v.channel || v.referenceCode);
  });

  constructor() {
    this.status.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.q.set({ status }));
    this.method.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((fulfilmentMethod) => this.q.set({ fulfilmentMethod }));
    this.channel.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((channel) => this.q.set({ channel }));
    this.ref.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((referenceCode) => this.q.set({ referenceCode }));
    // Keep the controls in sync when the URL changes (Back button, palette links).
    effect(() => {
      const v = this.q.value();
      untracked(() => {
        this.status.setValue(v.status, { emitEvent: false });
        this.method.setValue(v.fulfilmentMethod, { emitEvent: false });
        this.channel.setValue(v.channel, { emitEvent: false });
        if (this.ref.value.toUpperCase() !== v.referenceCode.toUpperCase())
          this.ref.setValue(v.referenceCode, { emitEvent: false });
      });
    });
  }

  protected select(r: IntakeRequest): void {
    this.q.set({ selected: r.id }, { keepPage: true });
  }
  protected close(): void {
    this.q.set({ selected: '' }, { keepPage: true });
  }
  protected clearFilters(): void {
    this.q.reset();
  }

  // §7 intake lifecycle → which buttons to show
  protected canReceive(r: IntakeRequest): boolean {
    return (r.status === 'Pending' && r.fulfilmentMethod === 'DropOff') || r.status === 'Collected';
  }
  protected canClose(r: IntakeRequest): boolean {
    return (
      this.isOps() &&
      (r.status === 'Pending' || r.status === 'Scheduled' || r.status === 'Collected')
    );
  }
  protected needsLocation(r: IntakeRequest): boolean {
    return r.status === 'Pending' && r.fulfilmentMethod === 'Pickup' && r.pickupLatitude === null;
  }

  protected newRequest(): void {
    this.modal.open<IntakeRequest>(CreateIntakeDialog).closed.subscribe((r) => {
      if (r) {
        this.list.reload();
        this.select(r);
      }
    });
  }
  protected walkIn(): void {
    this.modal.open<Device>(WalkInDialog).closed.subscribe((d) => {
      if (d) void this.router.navigate(['/ops/devices', d.id]);
    });
  }
  protected receive(r: IntakeRequest): void {
    this.modal.open<Device>(ReceiveDialog, r).closed.subscribe((d) => {
      if (!d) return;
      this.list.reload();
      this.selected.reload();
      this.toast.show(`Tracking ID ${d.trackingId}. Next: purchase.`, 'success', {
        title: 'Device created',
      });
    });
  }
  protected closeRequest(r: IntakeRequest, kind: 'cancel' | 'reject'): void {
    const data: ReasonDialogData = {
      title: kind === 'cancel' ? `Cancel ${r.referenceCode}?` : `Reject ${r.referenceCode}?`,
      message:
        kind === 'reject'
          ? 'The seller receives an SMS with your reason.'
          : 'Use this when the seller no longer wants to sell.',
      confirmLabel: kind === 'cancel' ? 'Cancel request' : 'Reject request',
      danger: true,
      submit: (reason) =>
        kind === 'cancel' ? this.intake.cancel(r.id, reason) : this.intake.reject(r.id, reason),
    };
    this.modal.open<IntakeRequest>(ReasonDialog, data).closed.subscribe((res) => {
      if (!res) return;
      this.toast.success(
        kind === 'cancel' ? 'Request cancelled.' : 'Request rejected. The seller was notified.',
      );
      this.list.reload();
      this.selected.reload();
    });
  }
  protected async openDevice(trackingId: string): Promise<void> {
    try {
      const d = await firstValueFrom(this.devices.byTracking(trackingId));
      await this.router.navigate(['/ops/devices', d.id]);
    } catch (e) {
      this.toast.error(e);
    }
  }

  protected money(v: number | null): string {
    return formatSle(v);
  }
  protected when(v: string | null): string {
    return formatDateTime(v);
  }
  protected ago(v: string): string {
    return relativeTime(v);
  }
}
