import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { humanize } from '../../core/enums/labels';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

/** Default tone for every status value in §6. */
const TONES: Record<string, Tone> = {
  // generic / certificate verification
  Valid: 'success',
  Revoked: 'danger',
  Invalid: 'danger',
  NotFound: 'neutral',
  Healthy: 'success',
  Degraded: 'warning',
  Unhealthy: 'danger',
  // IntakeStatus
  Pending: 'warning',
  Scheduled: 'info',
  Collected: 'accent',
  Received: 'success',
  Rejected: 'danger',
  Cancelled: 'neutral',
  // DeviceStatus
  Purchased: 'info',
  Sanitized: 'success',
  SanitizationFailed: 'danger',
  Refurbishing: 'accent',
  Dismantled: 'neutral',
  Disposed: 'neutral',
  Listed: 'info',
  Sold: 'success',
  // ListingStatus / OrderStatus / Batches / Payout
  Draft: 'neutral',
  Published: 'success',
  Reserved: 'warning',
  Withdrawn: 'neutral',
  Paid: 'success',
  Fulfilled: 'accent',
  Failed: 'danger',
  Planned: 'info',
  InProgress: 'warning',
  Completed: 'success',
  // SanitizationOutcome / ComponentStatus / Enrollment
  Passed: 'success',
  NotEligible: 'warning',
  InStock: 'success',
  Scrapped: 'neutral',
  Enrolled: 'info',
  Dropped: 'neutral',
};

@Component({
  selector: 'status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "'tone-' + resolvedTone()" },
  template: `<span class="dot" aria-hidden="true"></span>{{ label() ?? text() }}`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 26px;
      padding: 0 10px;
      border-radius: var(--r-pill);
      font-size: var(--fs-xs);
      font-weight: 650;
      white-space: nowrap;
      color: var(--c);
      background: var(--b);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 22%, transparent);
    }
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
    }
    :host(.tone-success) {
      --c: var(--success);
      --b: var(--success-bg);
    }
    :host(.tone-warning) {
      --c: var(--warning);
      --b: var(--warning-bg);
    }
    :host(.tone-danger) {
      --c: var(--danger);
      --b: var(--danger-bg);
    }
    :host(.tone-info) {
      --c: var(--info);
      --b: var(--info-bg);
    }
    :host(.tone-accent) {
      --c: var(--accent-ink);
      --b: var(--accent-soft);
    }
    :host(.tone-neutral) {
      --c: var(--neutral);
      --b: var(--neutral-bg);
    }
  `,
})
export class StatusPill {
  readonly status = input.required<string>();
  readonly label = input<string>();
  readonly tone = input<Tone>();

  protected readonly resolvedTone = computed<Tone>(
    () => this.tone() ?? TONES[this.status()] ?? 'neutral',
  );
  protected readonly text = computed(() => humanize(this.status()));
}
