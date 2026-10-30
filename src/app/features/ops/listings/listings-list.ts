import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { BadgeCheck, LucideAngularModule, Plus, Store } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { ListingsApi } from '../../../core/api/commerce.api';
import type { Listing, ListingItemType, ListingStatus } from '../../../core/api/types';
import { LISTING_ITEM_TYPES, LISTING_STATUSES, options } from '../../../core/enums/labels';
import { formatSle } from '../../../core/format/format';
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
} from '../../../shared/ui';
import { withAll } from '../shared/ops-dialogs';
import { CreateListingDialog } from './listing-dialogs';

/** Listings manager (§8.13). */
@Component({
  selector: 'listings-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    GlassInput,
    GlassSelect,
    StatusPill,
    Paginator,
    Skeleton,
    EmptyState,
  ],
  template: `
    <page-header
      heading="Listings"
      subheading="Draft → photos verified → Published. Buyers only see published listings with verified photos."
    >
      <button page-actions glass-button variant="primary" type="button" (click)="create()">
        <lucide-icon [img]="i.Plus" [size]="16" aria-hidden="true" /> New listing
      </button>
    </page-header>
    <form
      class="filter-bar glass"
      role="search"
      aria-label="Filter listings"
      (submit)="$event.preventDefault()"
    >
      <glass-input
        label="Search"
        placeholder="Title, brand or model"
        [formControl]="search"
        autocomplete="off"
      />
      <glass-select label="Status" [options]="statusOptions" [formControl]="status" />
      <glass-select label="Type" [options]="typeOptions" [formControl]="type" />
      <div class="fb-actions">
        <button type="button" class="link-btn" (click)="q.set({ status: 'Draft' })">Drafts</button>
      </div>
    </form>
    <glass-card padding="sm">
      <div [attr.aria-busy]="list.isLoading()">
        @if (list.isLoading() && !list.value()) {
          <skeleton [lines]="8" height="22px" />
        } @else if (list.error()) {
          <div class="form-error" role="alert">
            {{ errorText() }}
            <button glass-button size="sm" type="button" (click)="list.reload()">Retry</button>
          </div>
        } @else if (list.value()?.items?.length) {
          <table class="data">
            <caption class="sr-only">
              Listings
            </caption>
            <thead>
              <tr>
                <th scope="col">Listing</th>
                <th scope="col">Type</th>
                <th scope="col" class="r">Price</th>
                <th scope="col">Grade</th>
                <th scope="col">Photos</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (l of list.value()!.items; track l.id) {
                <tr>
                  <td data-label="Listing">
                    <a class="row-link" [routerLink]="['/ops/listings', l.id]">{{ l.title }}</a>
                    <div class="subtle tiny">
                      <span class="mono">{{ l.listingCode }}</span>
                      @if (l.certificateNumber) {
                        · <lucide-icon [img]="i.BadgeCheck" [size]="12" aria-hidden="true" />
                        {{ l.certificateNumber }}
                      }
                    </div>
                  </td>
                  <td data-label="Type">{{ l.itemType === 'Component' ? 'Part' : 'Phone' }}</td>
                  <td data-label="Price" class="r num">{{ money(l.priceSle) }}</td>
                  <td data-label="Grade">{{ l.condition }}</td>
                  <td data-label="Photos" class="num">
                    {{ verified(l) }}/{{ l.photos.length }} verified
                  </td>
                  <td data-label="Status"><status-pill [status]="l.status" /></td>
                </tr>
              }
            </tbody>
          </table>
          <glass-paginator
            [page]="list.value()!.page"
            [pageSize]="list.value()!.pageSize"
            [total]="list.value()!.totalCount"
            [pages]="list.value()!.totalPages"
            (pageChange)="q.setPage($event)"
          />
        } @else {
          <empty-state
            heading="No listings"
            message="List a refurbished phone (status Refurbishing) or a recovered part."
            [icon]="i.Store"
          >
            <button glass-button size="sm" variant="primary" type="button" (click)="create()">
              New listing
            </button>
          </empty-state>
        }
      </div>
    </glass-card>
  `,
  styles: `
    .tiny {
      font-size: var(--fs-xs);
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
  `,
})
export class ListingsList {
  private readonly listings = inject(ListingsApi);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  protected readonly i = { Plus, Store, BadgeCheck };
  protected readonly statusOptions = withAll(options(LISTING_STATUSES), 'Any status');
  protected readonly typeOptions = withAll(
    options(LISTING_ITEM_TYPES, { RefurbishedDevice: 'Refurbished phone', Component: 'Part' }),
    'Phones and parts',
  );

  protected readonly q = urlQuery({ status: '', itemType: '', search: '' });
  protected readonly search = new FormControl(this.q.value().search, { nonNullable: true });
  protected readonly status = new FormControl(this.q.value().status, { nonNullable: true });
  protected readonly type = new FormControl(this.q.value().itemType, { nonNullable: true });
  protected readonly list = rxResource({
    params: () => ({ ...this.q.value(), page: this.q.page() }),
    stream: ({ params: p }) =>
      this.listings.list({
        status: opt<ListingStatus>(p.status),
        itemType: opt<ListingItemType>(p.itemType),
        search: p.search.trim() || undefined,
        page: p.page,
        pageSize: 20,
      }),
  });
  protected readonly errorText = computed(() => errorMessage(this.list.error()));

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((search) => this.q.set({ search }));
    this.status.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.q.set({ status }));
    this.type.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((itemType) => this.q.set({ itemType }));
  }

  protected create(): void {
    this.modal
      .open<Listing>(CreateListingDialog)
      .closed.subscribe((l) => l && void this.router.navigate(['/ops/listings', l.id]));
  }
  protected verified(l: Listing): number {
    return l.photos.filter((p) => p.isVerified).length;
  }
  protected money(v: number): string {
    return formatSle(v);
  }
}
