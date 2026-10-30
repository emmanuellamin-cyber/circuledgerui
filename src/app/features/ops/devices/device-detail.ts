import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { ArrowLeft, HandCoins, LucideAngularModule, Receipt, Store } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { DevicesApi } from '../../../core/api/devices.api';
import type { Device, Listing, Purchase } from '../../../core/api/types';
import { AuthService } from '../../../core/auth/auth.service';
import { POLICY } from '../../../core/auth/roles';
import {
  CHANNEL_LABELS,
  DEVICE_CONDITION_LABELS,
  DEVICE_STATUS_LABELS,
  PAYOUT_METHOD_LABELS,
  SANITIZATION_METHOD_LABELS,
  humanize,
} from '../../../core/enums/labels';
import { formatDateTime, formatSle } from '../../../core/format/format';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  ModalService,
  PageHeader,
  Skeleton,
  StatusPill,
} from '../../../shared/ui';
import { BreadcrumbService } from '../breadcrumb.service';
import { CreateListingDialog } from '../listings/listing-dialogs';
import { LedgerTimeline } from '../shared/ledger-timeline';
import { PayoutDialog, PurchaseDialog } from '../shared/ops-dialogs';

/** Device detail: facts, purchase, sanitizations, ledger timeline, Ops actions from §7. */
@Component({
  selector: 'device-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    StatusPill,
    Skeleton,
    EmptyState,
    LedgerTimeline,
  ],
  templateUrl: './device-detail.html',
})
export class DeviceDetail {
  /** Route param. */
  readonly id = input.required<string>();

  private readonly devices = inject(DevicesApi);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);

  protected readonly i = { ArrowLeft, HandCoins, Receipt, Store };
  protected readonly conditionLabels = DEVICE_CONDITION_LABELS;
  protected readonly statusLabels = DEVICE_STATUS_LABELS;
  protected readonly channelLabels = CHANNEL_LABELS;
  protected readonly payoutLabels = PAYOUT_METHOD_LABELS;
  protected readonly methodLabels = SANITIZATION_METHOD_LABELS;
  protected readonly humanize = humanize;

  protected readonly device = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.devices.get(id),
  });
  protected readonly history = rxResource({
    params: () => this.device.value()?.trackingId,
    stream: ({ params: t }) => this.devices.history(t),
  });
  protected readonly wipes = rxResource({
    params: () => this.device.value()?.id,
    stream: ({ params: id }) => this.devices.sanitizations(id),
  });
  protected readonly purchase = rxResource({
    params: () => (this.device.value()?.purchase ? this.device.value()!.id : undefined),
    stream: ({ params: id }) => (id ? this.devices.getPurchase(id) : of(null)),
  });

  protected readonly isOps = computed(() => this.auth.hasRole(...POLICY.Ops));
  protected readonly errorText = computed(() =>
    errorMessage(this.device.error(), 'Could not load this device.'),
  );

  constructor() {
    effect(() => this.crumbs.detail.set(this.device.value()?.trackingId ?? null));
    inject(DestroyRef).onDestroy(() => this.crumbs.detail.set(null));
  }

  // §7 device lifecycle (Ops actions; workshop steps are shown as next-step hints)
  protected canPurchase(d: Device): boolean {
    return this.isOps() && d.status === 'Received';
  }
  protected canRecordPayout(d: Device): boolean {
    return this.isOps() && d.purchase?.payoutStatus === 'Pending';
  }
  protected canList(d: Device): boolean {
    return this.isOps() && d.status === 'Refurbishing';
  }
  protected nextStep(d: Device): string | null {
    switch (d.status) {
      case 'Purchased':
        return d.recoveryOutcome
          ? 'Workshop app: dismantle.'
          : 'Workshop app: record the data wipe.';
      case 'SanitizationFailed':
        return 'Workshop app: record the data wipe again.';
      case 'Sanitized':
        return d.recoveryOutcome
          ? 'Workshop app: dismantle.'
          : 'Workshop app: decide refurbish, dismantle or hazardous disposal.';
      case 'Dismantled':
        return 'Workshop app: add recovered components and log hazardous materials.';
      case 'Disposed':
        return 'Workshop app: log hazardous materials.';
      default:
        return null;
    }
  }

  protected buy(d: Device): void {
    this.modal.open<Purchase>(PurchaseDialog, d).closed.subscribe((p) => p && this.reload());
  }
  protected payout(d: Device): void {
    this.modal.open<Purchase>(PayoutDialog, d).closed.subscribe((p) => p && this.reload());
  }
  protected list(d: Device): void {
    this.modal
      .open<Listing>(CreateListingDialog, { itemType: 'RefurbishedDevice', deviceId: d.id })
      .closed.subscribe((l) => l && void this.router.navigate(['/ops/listings', l.id]));
  }

  protected money(v: number | null | undefined): string {
    return formatSle(v);
  }
  protected when(v: string | null | undefined): string {
    return formatDateTime(v);
  }

  private reload(): void {
    this.device.reload();
    this.history.reload();
    this.purchase.reload();
  }
}
