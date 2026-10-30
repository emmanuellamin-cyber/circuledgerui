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
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { LucideAngularModule, Smartphone } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { DevicesApi } from '../../../core/api/devices.api';
import type { DeviceStatus } from '../../../core/api/types';
import {
  DEVICE_CONDITION_LABELS,
  DEVICE_STATUSES,
  DEVICE_STATUS_LABELS,
  options,
} from '../../../core/enums/labels';
import { relativeTime } from '../../../core/format/format';
import { opt, urlQuery } from '../../../core/state/url-query';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassSelect,
  GlassSwitch,
  PageHeader,
  Paginator,
  Skeleton,
  StatusPill,
} from '../../../shared/ui';
import { withAll } from '../shared/ops-dialogs';

/** Devices register (§8.7). */
@Component({
  selector: 'devices-list',
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
    GlassSwitch,
    StatusPill,
    Paginator,
    Skeleton,
    EmptyState,
  ],
  template: `
    <page-header
      heading="Devices register"
      subheading="Every phone the Hub has received, by tracking ID."
    />
    <form
      class="filter-bar glass"
      role="search"
      aria-label="Filter devices"
      (submit)="$event.preventDefault()"
    >
      <glass-input
        label="Search"
        placeholder="CL-2026-000123 or model"
        [formControl]="search"
        autocomplete="off"
      />
      <glass-select label="Status" [options]="statusOptions" [formControl]="status" />
      <glass-input label="Brand" placeholder="Samsung" [formControl]="brand" autocomplete="off" />
      <div class="fb-actions"><glass-switch label="Samsung only" [formControl]="samsung" /></div>
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
              Devices
            </caption>
            <thead>
              <tr>
                <th scope="col">Tracking ID</th>
                <th scope="col">Phone</th>
                <th scope="col">IMEI</th>
                <th scope="col">Location</th>
                <th scope="col">Certificate</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (d of list.value()!.items; track d.id) {
                <tr>
                  <td data-label="Tracking ID">
                    <a class="row-link mono" [routerLink]="['/ops/devices', d.id]">{{
                      d.trackingId
                    }}</a>
                    <div class="subtle tiny">{{ ago(d.createdAt) }}</div>
                  </td>
                  <td data-label="Phone">
                    {{ d.brand }}{{ d.model ? ' ' + d.model : '' }}
                    <div class="subtle tiny">{{ conditionLabels[d.condition] }}</div>
                  </td>
                  <td data-label="IMEI" class="mono">{{ d.maskedImei }}</td>
                  <td data-label="Location">{{ d.locationName ?? '—' }}</td>
                  <td data-label="Certificate" class="mono">
                    @if (d.certificateNumber) {
                      <a [routerLink]="['/ops/certificates', d.certificateNumber]">{{
                        d.certificateNumber
                      }}</a>
                    } @else {
                      —
                    }
                  </td>
                  <td data-label="Status">
                    <status-pill [status]="d.status" [label]="statusLabels[d.status]" />
                  </td>
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
            heading="No devices found"
            [message]="
              filtered()
                ? 'Try clearing a filter.'
                : 'Devices appear when phones are received at a hub.'
            "
            [icon]="Smartphone"
          >
            @if (filtered()) {
              <button glass-button size="sm" type="button" (click)="q.reset()">
                Clear filters
              </button>
            } @else {
              <a glass-button size="sm" variant="primary" routerLink="/ops/intake"
                >Go to intake inbox</a
              >
            }
          </empty-state>
        }
      </div>
    </glass-card>
  `,
  styles: `
    .tiny {
      font-size: var(--fs-xs);
    }
  `,
})
export class DevicesList {
  private readonly devices = inject(DevicesApi);
  protected readonly Smartphone = Smartphone;
  protected readonly conditionLabels = DEVICE_CONDITION_LABELS;
  protected readonly statusLabels = DEVICE_STATUS_LABELS;
  protected readonly statusOptions = withAll(
    options(DEVICE_STATUSES, DEVICE_STATUS_LABELS),
    'Any status',
  );

  protected readonly q = urlQuery({ status: '', brand: '', search: '', samsungOnly: '' });
  protected readonly search = new FormControl(this.q.value().search, { nonNullable: true });
  protected readonly brand = new FormControl(this.q.value().brand, { nonNullable: true });
  protected readonly status = new FormControl(this.q.value().status, { nonNullable: true });
  protected readonly samsung = new FormControl(this.q.value().samsungOnly === 'true', {
    nonNullable: true,
  });

  protected readonly list = rxResource({
    params: () => ({ ...this.q.value(), page: this.q.page() }),
    stream: ({ params: p }) =>
      this.devices.list({
        status: opt<DeviceStatus>(p.status),
        brand: p.brand.trim() || undefined,
        search: p.search.trim() || undefined,
        samsungOnly: p.samsungOnly === 'true' ? true : undefined,
        page: p.page,
        pageSize: 20,
      }),
  });
  protected readonly errorText = computed(() => errorMessage(this.list.error()));
  protected readonly filtered = computed(() => Object.values(this.q.value()).some((v) => v !== ''));

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((search) => this.q.set({ search }));
    this.brand.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((brand) => this.q.set({ brand }));
    this.status.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.q.set({ status }));
    this.samsung.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((v) => this.q.set({ samsungOnly: v ? 'true' : '' }));
    effect(() => {
      const v = this.q.value();
      untracked(() => {
        this.status.setValue(v.status, { emitEvent: false });
        this.samsung.setValue(v.samsungOnly === 'true', { emitEvent: false });
        if (this.search.value !== v.search) this.search.setValue(v.search, { emitEvent: false });
        if (this.brand.value !== v.brand) this.brand.setValue(v.brand, { emitEvent: false });
      });
    });
  }

  protected ago(v: string): string {
    return relativeTime(v);
  }
}
