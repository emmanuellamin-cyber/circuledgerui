import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  ArrowLeft,
  BadgeCheck,
  Eye,
  ImagePlus,
  LucideAngularModule,
  Pencil,
  Send,
  Undo2,
} from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { ListingsApi } from '../../../core/api/commerce.api';
import type { Listing, ListingPhoto } from '../../../core/api/types';
import { AuthService } from '../../../core/auth/auth.service';
import { POLICY } from '../../../core/auth/roles';
import { formatDateTime, formatSle } from '../../../core/format/format';
import { useAction } from '../../../core/state/action';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  ModalService,
  PageHeader,
  Skeleton,
  StatusPill,
  ToastService,
} from '../../../shared/ui';
import { BreadcrumbService } from '../breadcrumb.service';
import { EditListingDialog } from './listing-dialogs';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Listing editor: photos (upload → verify by a different person) → Publish / Withdraw (§8.13).
 * Publish is enabled only when at least one photo is verified (§13).
 */
@Component({
  selector: 'listing-detail',
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
  ],
  templateUrl: './listing-detail.html',
})
export class ListingDetail {
  readonly id = input.required<string>();
  private readonly listings = inject(ListingsApi);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);

  protected readonly i = { ArrowLeft, BadgeCheck, Eye, ImagePlus, Pencil, Send, Undo2 };
  protected readonly accept = ACCEPT.join(',');
  protected readonly listing = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.listings.get(id),
  });
  protected readonly upload = useAction();
  protected readonly lifecycle = useAction();
  protected readonly verifying = signal<string | null>(null);
  /** Staff photos need a blob fetch with the auth header (§5). photoId → object URL. */
  protected readonly previews = signal<Record<string, string>>({});
  protected readonly isOps = computed(() => this.auth.hasRole(...POLICY.Ops));
  protected readonly errorText = computed(() => errorMessage(this.listing.error()));

  protected readonly hasVerified = computed(
    () => this.listing.value()?.photos.some((p) => p.isVerified) ?? false,
  );
  protected readonly canEdit = computed(() =>
    ['Draft', 'Published', 'Withdrawn'].includes(this.listing.value()?.status ?? ''),
  );
  protected readonly canPublish = computed(() =>
    ['Draft', 'Withdrawn'].includes(this.listing.value()?.status ?? ''),
  );
  protected readonly canWithdraw = computed(() =>
    ['Draft', 'Published'].includes(this.listing.value()?.status ?? ''),
  );

  constructor() {
    effect(() => this.crumbs.detail.set(this.listing.value()?.listingCode ?? null));
    effect(() => {
      const l = this.listing.value();
      if (!l) return;
      for (const p of l.photos) {
        if (this.previews()[p.id]) continue;
        this.listings
          .photoObjectUrl(l.id, p.id)
          .then((url) => this.previews.update((m) => ({ ...m, [p.id]: url })))
          .catch(() => undefined);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      Object.values(this.previews()).forEach((u) => URL.revokeObjectURL(u));
      this.crumbs.detail.set(null);
    });
  }

  protected edit(l: Listing): void {
    this.modal
      .open<Listing>(EditListingDialog, l)
      .closed.subscribe((res) => res && this.listing.reload());
  }

  protected async onFile(l: Listing, e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    for (const file of files) {
      if (!ACCEPT.includes(file.type)) {
        this.upload.error.set(`${file.name}: only JPEG, PNG or WebP images.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        this.upload.error.set(`${file.name} is larger than 5 MB.`);
        continue;
      }
      await this.upload.run(this.listings.uploadPhoto(l.id, file), {
        success: `${file.name} uploaded. Another person must verify it.`,
      });
    }
    this.listing.reload();
  }

  protected async verify(l: Listing, p: ListingPhoto): Promise<void> {
    this.verifying.set(p.id);
    try {
      await this.lifecycle.run(this.listings.verifyPhoto(l.id, p.id), {
        success: 'Photo verified.',
        toastErrors: true,
      });
    } finally {
      this.verifying.set(null);
      this.listing.reload();
    }
  }

  protected async publish(l: Listing): Promise<void> {
    const res = await this.lifecycle.run(this.listings.publish(l.id), {
      success: 'Published. It is now visible in the marketplace.',
      messages: { photo_required: 'Publishing needs at least one verified photo.' },
    });
    if (res) this.listing.reload();
  }

  protected async withdraw(l: Listing): Promise<void> {
    const ok = await this.modal.confirm({
      title: `Withdraw ${l.listingCode}?`,
      message: 'It disappears from the marketplace. You can publish it again later.',
      confirmLabel: 'Withdraw',
      danger: true,
    });
    if (!ok) return;
    const res = await this.lifecycle.run(this.listings.withdraw(l.id), {
      success: 'Listing withdrawn.',
    });
    if (res) this.listing.reload();
  }

  protected money(v: number): string {
    return formatSle(v);
  }
  protected when(v: string | null): string {
    return formatDateTime(v);
  }
  protected size(bytes: number): string {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
}
