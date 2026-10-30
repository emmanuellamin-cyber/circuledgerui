import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Link2, LucideAngularModule, ShieldCheck } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { LedgerApi } from '../../../core/api/admin.api';
import type { LedgerEntry, LedgerEventType, LedgerVerification } from '../../../core/api/types';
import {
  LEDGER_ENTITY_TYPES,
  LEDGER_EVENTS,
  LEDGER_EVENT_LABELS,
  options,
} from '../../../core/enums/labels';
import { formatDateTime, formatNumber } from '../../../core/format/format';
import { useAction } from '../../../core/state/action';
import { opt, urlQuery } from '../../../core/state/url-query';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  GlassSelect,
  PageHeader,
  Paginator,
  Skeleton,
} from '../../../shared/ui';
import { withAll } from '../shared/ops-dialogs';

/** Ledger explorer (§8.18): browse entries, verify the hash chain on demand. */
@Component({
  selector: 'ledger-explorer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    GlassSelect,
    Paginator,
    Skeleton,
    EmptyState,
  ],
  template: `
    <page-header
      heading="Ledger explorer"
      subheading="Every state change is chained by hash. Verifying recomputes the whole chain, so it runs only when you ask."
    >
      <button
        page-actions
        glass-button
        variant="primary"
        type="button"
        [loading]="verifying.busy()"
        (click)="verify()"
      >
        <lucide-icon [img]="i.ShieldCheck" [size]="16" aria-hidden="true" /> Verify integrity
      </button>
    </page-header>

    <div aria-live="polite">
      @if (verification(); as v) {
        @if (v.isValid) {
          <p class="banner ok">
            Chain valid · {{ num(v.entriesChecked) }} entries checked · last hash
            <span class="mono">{{ v.lastHash?.slice(0, 16) }}…</span>
          </p>
        } @else {
          <p class="banner bad" role="alert">
            <lucide-icon [img]="i.Link2" [size]="16" aria-hidden="true" /> Chain broken at entry #{{
              v.firstBrokenSequence
            }}: {{ v.reason }}
          </p>
        }
      }
      @if (verifying.error(); as e) {
        <p class="form-error" role="alert">{{ e }}</p>
      }
    </div>

    <form
      class="filter-bar glass"
      role="search"
      aria-label="Filter ledger"
      (submit)="$event.preventDefault()"
    >
      <glass-select label="Entity" [options]="entityOptions" [formControl]="entity" />
      <glass-select label="Event" [options]="eventOptions" [formControl]="event" />
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
              Ledger entries, newest first
            </caption>
            <thead>
              <tr>
                <th scope="col" class="r">#</th>
                <th scope="col">When</th>
                <th scope="col">Event</th>
                <th scope="col">Entity</th>
                <th scope="col">Device</th>
                <th scope="col">Hash</th>
              </tr>
            </thead>
            <tbody>
              @for (e of list.value()!.items; track e.sequenceNumber) {
                <tr
                  class="clickable"
                  (click)="toggle(e)"
                  [attr.aria-expanded]="open() === e.sequenceNumber"
                >
                  <td data-label="#" class="r num">{{ e.sequenceNumber }}</td>
                  <td data-label="When">{{ when(e.timestamp) }}</td>
                  <td data-label="Event">{{ eventLabels[e.eventType] }}</td>
                  <td data-label="Entity">{{ e.entityType }}</td>
                  <td data-label="Device" class="mono">
                    @if (e.trackingId) {
                      <a
                        [routerLink]="['/ops/devices']"
                        [queryParams]="{ search: e.trackingId }"
                        (click)="$event.stopPropagation()"
                        >{{ e.trackingId }}</a
                      >
                    } @else {
                      —
                    }
                  </td>
                  <td data-label="Hash" class="mono">{{ e.hash.slice(0, 10) }}…</td>
                </tr>
                @if (open() === e.sequenceNumber) {
                  <tr class="detail-row">
                    <td colspan="6">
                      <dl class="dl">
                        <div>
                          <dt>Actor</dt>
                          <dd class="mono">{{ e.actor }}</dd>
                        </div>
                        <div class="wide">
                          <dt>Previous hash</dt>
                          <dd class="mono h">{{ e.previousHash }}</dd>
                        </div>
                        <div class="wide">
                          <dt>Hash</dt>
                          <dd class="mono h">{{ e.hash }}</dd>
                        </div>
                      </dl>
                      <pre class="payload">{{ json(e) }}</pre>
                    </td>
                  </tr>
                }
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
            heading="No ledger entries match"
            message="Try another entity or event type."
          />
        }
      </div>
    </glass-card>
  `,
  styles: `
    .banner,
    .form-error {
      margin-bottom: var(--s-3);
    }
    .detail-row td {
      background: var(--glass-fill-nested);
    }
    .h {
      font-size: var(--fs-xs);
      word-break: break-all;
    }
    .payload {
      margin: var(--s-3) 0 0;
      padding: var(--s-3);
      border-radius: var(--r-sm);
      background: var(--neutral-bg);
      font-size: var(--fs-xs);
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 240px;
      overflow: auto;
    }
  `,
})
export class LedgerExplorer {
  private readonly ledger = inject(LedgerApi);
  protected readonly i = { ShieldCheck, Link2 };
  protected readonly eventLabels = LEDGER_EVENT_LABELS;
  protected readonly entityOptions = withAll(options(LEDGER_ENTITY_TYPES), 'Any entity');
  protected readonly eventOptions = withAll(
    options(LEDGER_EVENTS, LEDGER_EVENT_LABELS),
    'Any event',
  );
  protected readonly verifying = useAction();
  protected readonly verification = signal<LedgerVerification | null>(null);
  protected readonly open = signal<number | null>(null);

  protected readonly q = urlQuery({ entityType: '', eventType: '' });
  protected readonly entity = new FormControl(this.q.value().entityType, { nonNullable: true });
  protected readonly event = new FormControl(this.q.value().eventType, { nonNullable: true });
  protected readonly list = rxResource({
    params: () => ({ ...this.q.value(), page: this.q.page() }),
    stream: ({ params: p }) =>
      this.ledger.list({
        entityType: p.entityType || undefined,
        eventType: opt<LedgerEventType>(p.eventType),
        page: p.page,
        pageSize: 25,
      }),
  });
  protected readonly errorText = computed(() => errorMessage(this.list.error()));

  constructor() {
    this.entity.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((entityType) => this.q.set({ entityType }));
    this.event.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((eventType) => this.q.set({ eventType }));
  }

  async verify(): Promise<void> {
    const v = await this.verifying.run(this.ledger.verify());
    if (v) this.verification.set(v);
  }
  protected toggle(e: LedgerEntry): void {
    this.open.update((n) => (n === e.sequenceNumber ? null : e.sequenceNumber));
  }
  protected when(v: string): string {
    return formatDateTime(v);
  }
  protected num(v: number): string {
    return formatNumber(v);
  }
  protected json(e: LedgerEntry): string {
    return JSON.stringify(e.payload, null, 2);
  }
}
