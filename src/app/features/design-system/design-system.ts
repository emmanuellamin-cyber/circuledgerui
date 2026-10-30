import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Coins,
  LucideAngularModule,
  Mail,
  PackageSearch,
  Plus,
  Recycle,
  Smartphone,
  Trash2,
} from 'lucide-angular';
import { ThemeService } from '../../core/theme/theme.service';
import { SleCurrencyPipe, MaskedPipe, RelativeTimePipe } from '../../shared/pipes';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassModal,
  GlassSelect,
  GlassTab,
  GlassTabs,
  ModalService,
  Skeleton,
  StatTile,
  StatusPill,
  ToastService,
} from '../../shared/ui';

@Component({
  selector: 'ds-sample-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GlassModal, GlassButton, GlassInput, ReactiveFormsModule],
  template: `
    <glass-modal
      heading="Record payout"
      description="Sample dialog built from glass-modal."
      (closed)="close()"
    >
      <glass-input label="Payout reference" placeholder="OM-TXN-445566" [formControl]="ref" />
      <ng-container modal-footer>
        <button glass-button variant="ghost" type="button" (click)="close()">Cancel</button>
        <button glass-button variant="primary" type="button" (click)="close()">Save</button>
      </ng-container>
    </glass-modal>
  `,
})
class SampleModal {
  private readonly dialogRef = inject(DialogRef);
  protected readonly ref = new FormControl('');
  protected close(): void {
    this.dialogRef.close();
  }
}

/** Living reference of tokens and the glass component library (shown before the dashboards). */
@Component({
  selector: 'design-system-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    LucideAngularModule,
    GlassCard,
    GlassButton,
    GlassInput,
    GlassSelect,
    GlassTabs,
    StatTile,
    StatusPill,
    EmptyState,
    Skeleton,
    SleCurrencyPipe,
    MaskedPipe,
    RelativeTimePipe,
  ],
  templateUrl: './design-system.html',
  styleUrl: './design-system.scss',
})
export class DesignSystem {
  protected readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);
  private readonly modal = inject(ModalService);
  protected readonly i = { Smartphone, Recycle, Coins, Plus, Trash2, Mail, PackageSearch };

  protected readonly swatches = [
    { name: 'Accent', v: '--accent' },
    { name: 'Accent 2', v: '--accent-2' },
    { name: 'Amber', v: '--amber' },
    { name: 'Success', v: '--success' },
    { name: 'Warning', v: '--warning' },
    { name: 'Danger', v: '--danger' },
    { name: 'Info', v: '--info' },
    { name: 'Text 1', v: '--text-1' },
    { name: 'Text 2', v: '--text-2' },
    { name: 'Text 3', v: '--text-3' },
  ];
  protected readonly statuses = [
    'Pending',
    'Scheduled',
    'Collected',
    'Received',
    'Purchased',
    'Sanitized',
    'SanitizationFailed',
    'Refurbishing',
    'Listed',
    'Sold',
    'Rejected',
    'Cancelled',
    'Draft',
    'Published',
    'Reserved',
  ];
  protected readonly tabs: GlassTab[] = [
    { id: 'all', label: 'All', badge: 137 },
    { id: 'pending', label: 'Pending', badge: 12 },
    { id: 'pickup', label: 'Awaiting pickup' },
    { id: 'received', label: 'Received' },
  ];
  protected readonly tab = signal('all');
  protected readonly loadingDemo = signal(false);
  protected readonly sampleDate = new Date(Date.now() - 3 * 3600_000).toISOString();

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    imei: new FormControl('352099001761481', { nonNullable: true }),
    method: new FormControl('OrangeMoney', { nonNullable: true }),
  });
  protected readonly payoutOptions = [
    { value: 'Cash', label: 'Cash' },
    { value: 'OrangeMoney', label: 'Orange Money' },
    { value: 'Afrimoney', label: 'Afrimoney' },
  ];

  protected toastDemo(kind: 'success' | 'error' | 'warning' | 'info'): void {
    if (kind === 'success') this.toast.success('Seed Fund debited SLE 200.00', 'Phone purchased');
    else if (kind === 'error')
      this.toast.show(
        'Device Purchasing Seed Fund balance (SLE 120.00) is insufficient for SLE 200.00.',
        'error',
        { title: 'Insufficient funds', traceId: '0HNPMDNJ07FKT:00000001' },
      );
    else if (kind === 'warning')
      this.toast.show('Too many requests. Please wait a moment and try again.', 'warning');
    else this.toast.show('2 pending pickups have no location yet.', 'info');
  }

  protected openModal(): void {
    this.modal.open(SampleModal);
  }

  protected async confirmDemo(): Promise<void> {
    const ok = await this.modal.confirm({
      title: 'Revoke certificate CDS-2026-000045?',
      message: 'Anyone verifying this certificate will see it as revoked. This cannot be undone.',
      confirmLabel: 'Revoke',
      danger: true,
    });
    this.toast.show(
      ok ? 'Confirmed (demo, nothing was sent).' : 'Cancelled.',
      ok ? 'success' : 'info',
    );
  }

  protected pulseLoading(): void {
    this.loadingDemo.set(true);
    setTimeout(() => this.loadingDemo.set(false), 1600);
  }
}
