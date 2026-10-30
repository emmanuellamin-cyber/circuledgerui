import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  BadgeCheck,
  Coins,
  Cpu,
  Eraser,
  Hammer,
  HandCoins,
  Inbox,
  LucideAngularModule,
  LucideIconData,
  PackageCheck,
  ShoppingBag,
  Store,
  TriangleAlert,
} from 'lucide-angular';
import type { LedgerEntry, LedgerEventType } from '../../../core/api/types';
import { LEDGER_EVENT_LABELS, humanize } from '../../../core/enums/labels';
import { formatDateTime } from '../../../core/format/format';

const ICONS: Record<LedgerEventType, LucideIconData> = {
  IntakeCreated: Inbox,
  DeviceReceived: PackageCheck,
  Purchased: HandCoins,
  Sanitized: Eraser,
  CertificateIssued: BadgeCheck,
  Dismantled: Hammer,
  ComponentRecovered: Cpu,
  MaterialDiverted: TriangleAlert,
  Listed: Store,
  Sold: ShoppingBag,
  Reinvested: Coins,
};

/** Vertical glass timeline of a device's ledger history (GET /ledger/devices/{trackingId}). */
@Component({
  selector: 'ledger-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <ol class="tl">
      @for (e of events(); track e.sequenceNumber) {
        <li class="ev">
          <span class="node" aria-hidden="true"
            ><lucide-icon [img]="icon(e.eventType)" [size]="18"
          /></span>
          <div class="card glass">
            <div class="top">
              <strong>{{ label(e.eventType) }}</strong>
              <time class="subtle" [attr.datetime]="e.timestamp">{{ when(e.timestamp) }}</time>
            </div>
            <dl class="payload">
              @for (kv of entries(e); track kv[0]) {
                <div>
                  <dt>{{ humanize(kv[0]) }}</dt>
                  <dd>{{ kv[1] }}</dd>
                </div>
              }
            </dl>
            <p class="meta mono" [title]="'hash ' + e.hash + ' · previous ' + e.previousHash">
              #{{ e.sequenceNumber }} · {{ e.entityType }} · by
              {{ e.actor === 'system' ? 'system' : e.actor.slice(0, 8) }} ·
              {{ e.hash.slice(0, 10) }}…
            </p>
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    .tl {
      position: relative;
      list-style: none;
      margin: 0;
      padding: 0 0 0 48px;
      display: grid;
      gap: var(--s-3);
    }
    .tl::before {
      content: '';
      position: absolute;
      left: 19px;
      top: 8px;
      bottom: 8px;
      width: 3px;
      border-radius: 3px;
      background: linear-gradient(180deg, #10b981, #0a84c6, #f59e0b);
      opacity: 0.6;
    }
    .ev {
      position: relative;
    }
    .node {
      position: absolute;
      left: -48px;
      top: 10px;
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      color: #fff;
      background: var(--accent-gradient);
      box-shadow: 0 0 0 4px var(--glass-fill-subtle);
    }
    .card {
      padding: var(--s-3) var(--s-4);
      border-radius: var(--r-md);
      display: grid;
      gap: 6px;
    }
    .top {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: var(--s-2);
      font-size: var(--fs-sm);
    }
    .top time {
      font-size: var(--fs-xs);
    }
    .payload {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      margin: 0;
      font-size: var(--fs-xs);
    }
    .payload div {
      display: flex;
      gap: 4px;
    }
    .payload dt {
      color: var(--text-3);
    }
    .payload dd {
      margin: 0;
      font-weight: 600;
    }
    .meta {
      font-size: 11px;
      color: var(--text-3);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class LedgerTimeline {
  readonly events = input.required<readonly LedgerEntry[]>();
  protected readonly humanize = humanize;

  protected icon(t: LedgerEventType): LucideIconData {
    return ICONS[t] ?? Inbox;
  }
  protected label(t: LedgerEventType): string {
    return LEDGER_EVENT_LABELS[t] ?? humanize(t);
  }
  protected when(v: string): string {
    return formatDateTime(v);
  }
  /** Payload is free-form per event type (§8.18): render key/values generically. */
  protected entries(e: LedgerEntry): [string, string][] {
    return Object.entries(e.payload ?? {})
      .filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object')
      .slice(0, 8)
      .map(([k, v]) => [k, String(v)]);
  }
}
