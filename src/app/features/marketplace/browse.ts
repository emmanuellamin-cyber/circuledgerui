import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import {
  BadgeCheck,
  LucideAngularModule,
  PackageSearch,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
} from 'lucide-angular';
import { errorMessage } from '../../core/api/api-error';
import { PublicApi } from '../../core/api/public.api';
import type {
  ComponentType,
  Grade,
  Listing,
  ListingItemType,
  ListingSearchQuery,
} from '../../core/api/types';
import { COMPONENT_TYPES, GRADES, LISTING_ITEM_TYPES, options } from '../../core/enums/labels';
import { formatSle } from '../../core/format/format';
import { opt, urlQuery } from '../../core/state/url-query';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassSelect,
  GlassSwitch,
  LiquidDirective,
  Paginator,
  Skeleton,
  ToastService,
} from '../../shared/ui';
import { withAll } from '../ops/shared/ops-dialogs';
import { CartService } from './cart.service';

type Sort = NonNullable<ListingSearchQuery['sort']>;

const DEFAULTS = {
  search: '',
  brand: '',
  itemType: '',
  componentType: '',
  condition: '',
  minPrice: '',
  maxPrice: '',
  samsungOnly: '',
  sort: 'newest',
};
type Key = keyof typeof DEFAULTS;

/** Marketplace browse (§8.3, §9 D): public, Published listings only. Search debounced 300 ms (§13). */
@Component({
  selector: 'marketplace-browse',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    GlassCard,
    GlassButton,
    GlassInput,
    GlassSelect,
    GlassSwitch,
    LiquidDirective,
    Paginator,
    Skeleton,
    EmptyState,
  ],
  templateUrl: './browse.html',
  styleUrl: './browse.scss',
})
export class MarketplaceBrowse {
  private readonly api = inject(PublicApi);
  protected readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  protected readonly i = { BadgeCheck, ShoppingBag, Smartphone, PackageSearch, SlidersHorizontal };
  /** Phones: whether the filters under Search are unfolded. Wider screens always show them. */
  protected readonly showFilters = signal(false);

  protected readonly typeOptions = withAll(
    options(LISTING_ITEM_TYPES, { RefurbishedDevice: 'Refurbished phones', Component: 'Parts' }),
    'Phones and parts',
  );
  protected readonly partOptions = withAll(
    options(COMPONENT_TYPES, { ChargingPort: 'Charging port' }),
    'Any part',
  );
  protected readonly gradeOptions = withAll(options(GRADES), 'Any grade');
  protected readonly sortOptions = options<Sort>(['newest', 'price_asc', 'price_desc'], {
    newest: 'Newest',
    price_asc: 'Price: low to high',
    price_desc: 'Price: high to low',
  });

  protected readonly q = urlQuery(DEFAULTS);
  protected readonly search = new FormControl(this.q.value().search, { nonNullable: true });
  protected readonly brand = new FormControl(this.q.value().brand, { nonNullable: true });
  protected readonly itemType = new FormControl(this.q.value().itemType, { nonNullable: true });
  protected readonly componentType = new FormControl(this.q.value().componentType, {
    nonNullable: true,
  });
  protected readonly condition = new FormControl(this.q.value().condition, { nonNullable: true });
  protected readonly minPrice = new FormControl(this.q.value().minPrice, { nonNullable: true });
  protected readonly maxPrice = new FormControl(this.q.value().maxPrice, { nonNullable: true });
  protected readonly samsung = new FormControl(this.q.value().samsungOnly === 'true', {
    nonNullable: true,
  });
  protected readonly sort = new FormControl(this.q.value().sort, { nonNullable: true });

  protected readonly list = rxResource({
    params: () => ({ ...this.q.value(), page: this.q.page() }),
    stream: ({ params: p }) =>
      this.api.listings({
        search: p.search.trim() || undefined,
        brand: p.brand.trim() || undefined,
        itemType: opt<ListingItemType>(p.itemType),
        componentType: p.itemType === 'Component' ? opt<ComponentType>(p.componentType) : undefined,
        condition: opt<Grade>(p.condition),
        minPrice: p.minPrice ? Number(p.minPrice) : undefined,
        maxPrice: p.maxPrice ? Number(p.maxPrice) : undefined,
        samsungOnly: p.samsungOnly === 'true' ? true : undefined,
        sort: p.sort as Sort,
        page: p.page,
        pageSize: 12,
      }),
  });
  protected readonly errorText = computed(() =>
    errorMessage(this.list.error(), 'Could not load the marketplace.'),
  );
  protected readonly filtered = computed(() => {
    const v = this.q.value();
    return Object.entries(v).some(([k, val]) => k !== 'sort' && val !== '');
  });
  /** Filters hidden behind the phone "Filters" button that are set (Search stays visible). */
  protected readonly activeFilters = computed(() => {
    const v = this.q.value();
    return Object.entries(v).filter(([k, val]) => k !== 'sort' && k !== 'search' && val !== '')
      .length;
  });

  constructor() {
    const typed = (c: FormControl<string>, key: Key) =>
      c.valueChanges
        .pipe(debounceTime(300), takeUntilDestroyed())
        .subscribe((v) => this.q.set({ [key]: v }));
    const picked = (c: FormControl<string>, key: Key) =>
      c.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => this.q.set({ [key]: v }));
    typed(this.search, 'search');
    typed(this.brand, 'brand');
    typed(this.minPrice, 'minPrice');
    typed(this.maxPrice, 'maxPrice');
    picked(this.itemType, 'itemType');
    picked(this.componentType, 'componentType');
    picked(this.condition, 'condition');
    picked(this.sort, 'sort');
    this.samsung.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((v) => this.q.set({ samsungOnly: v ? 'true' : '' }));
    effect(() => {
      const v = this.q.value();
      untracked(() => {
        for (const [c, val] of [
          [this.itemType, v.itemType],
          [this.componentType, v.componentType],
          [this.condition, v.condition],
          [this.sort, v.sort],
        ] as [FormControl<string>, string][]) {
          if (c.value !== val) c.setValue(val, { emitEvent: false });
        }
        this.samsung.setValue(v.samsungOnly === 'true', { emitEvent: false });
      });
    });
  }

  /** Public photos are relative URLs: prefix the base and use them directly (§5). */
  protected photo(l: Listing): string | null {
    const p = l.photos.find((x) => x.isVerified) ?? l.photos[0];
    return p ? this.api.photoSrc(p.url) : null;
  }
  protected add(l: Listing): void {
    if (this.cart.full()) {
      this.toast.show('A cart holds up to 20 items.', 'warning');
      return;
    }
    if (this.cart.add(l, this.photo(l))) this.toast.success(`${l.title} added to your cart.`);
  }
  protected money(v: number): string {
    return formatSle(v);
  }
  protected clear(): void {
    this.search.setValue('', { emitEvent: false });
    this.brand.setValue('', { emitEvent: false });
    this.minPrice.setValue('', { emitEvent: false });
    this.maxPrice.setValue('', { emitEvent: false });
    this.q.reset();
  }
}
