import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  BadgeCheck,
  Copy,
  LucideAngularModule,
  QrCode,
  ShieldAlert,
  ShieldX,
  SearchX,
} from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { PublicApi } from '../../../core/api/public.api';
import type { PublicCertificateVerification } from '../../../core/api/types';
import { SANITIZATION_METHOD_LABELS } from '../../../core/enums/labels';
import { formatDateTime } from '../../../core/format/format';
import { GlassButton, GlassInput, StatusPill } from '../../../shared/ui';

/** `GET /public/certificates/{no}/verify` with a clear valid / invalid result card (§8.3). */
@Component({
  selector: 'certificate-verify-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassInput, GlassButton, StatusPill, LucideAngularModule],
  template: `
    <form class="form" (ngSubmit)="verify()" aria-label="Verify a certificate">
      <glass-input
        label="Certificate number"
        placeholder="CDS-2026-000045"
        hint="Printed on the certificate and sent to you by SMS."
        autocomplete="off"
        [icon]="icons.QrCode"
        [formControl]="number"
      />
      <button glass-button variant="primary" type="submit" [loading]="loading()">Verify</button>
    </form>

    <div class="result-region" aria-live="polite">
      @if (error(); as e) {
        <p class="form-error" role="alert">{{ e }}</p>
      }
      @if (result(); as r) {
        <article
          class="result glass"
          [class]="'result glass tone-' + tone()"
          [attr.aria-label]="'Result for ' + r.certificateNumber"
        >
          <div class="mark" aria-hidden="true">
            <lucide-icon [img]="resultIcon()" [size]="34" />
          </div>
          <div class="body">
            <div class="row">
              <h3>{{ headline() }}</h3>
              <status-pill [status]="r.status" />
            </div>
            <p class="no mono">{{ r.certificateNumber }}</p>
            @if (r.reason) {
              <p class="reason">{{ r.reason }}</p>
            }
            @if (r.status !== 'NotFound') {
              <dl>
                @if (r.device) {
                  <div>
                    <dt>Device</dt>
                    <dd>{{ r.device }}</dd>
                  </div>
                }
                @if (r.maskedImei) {
                  <div>
                    <dt>IMEI</dt>
                    <dd class="mono">{{ r.maskedImei }}</dd>
                  </div>
                }
                @if (r.method) {
                  <div>
                    <dt>Method</dt>
                    <dd>
                      {{ methodLabel(r) }}
                      @if (r.passes) {
                        , {{ r.passes }} pass{{ r.passes === 1 ? '' : 'es' }}
                      }
                    </dd>
                  </div>
                }
                @if (r.issuedAt) {
                  <div>
                    <dt>Issued</dt>
                    <dd>{{ issued(r) }}</dd>
                  </div>
                }
                @if (r.issuer) {
                  <div class="wide">
                    <dt>Issuer</dt>
                    <dd>{{ r.issuer }}</dd>
                  </div>
                }
                @if (r.payloadHash) {
                  <div class="wide">
                    <dt>Payload hash</dt>
                    <dd class="hash">
                      <code>{{ r.payloadHash }}</code>
                      <button
                        type="button"
                        class="copy"
                        aria-label="Copy payload hash"
                        (click)="copy(r.payloadHash)"
                      >
                        <lucide-icon [img]="icons.Copy" [size]="15" />
                      </button>
                    </dd>
                  </div>
                }
              </dl>
            }
          </div>
        </article>
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--s-4);
    }
    .form {
      display: grid;
      gap: var(--s-3);
      align-items: start;
    }
    @media (min-width: 600px) {
      .form {
        grid-template-columns: 1fr auto;
      }
      .form button {
        margin-top: 27px;
      }
    }
    .result {
      display: flex;
      gap: var(--s-4);
      padding: var(--s-5);
      border-radius: var(--r-xl);
      animation: in var(--dur-3) var(--ease-spring);
    }
    .mark {
      flex: none;
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      color: #fff;
      background: var(--mark);
      box-shadow: 0 10px 26px -10px var(--mark);
    }
    .tone-success {
      --mark: #16a34a;
    }
    .tone-danger {
      --mark: #dc2626;
    }
    .tone-warning {
      --mark: #d97706;
    }
    .tone-neutral {
      --mark: #64748b;
    }
    .body {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 6px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--s-2) var(--s-3);
    }
    h3 {
      font-size: var(--fs-xl);
    }
    .no {
      color: var(--text-2);
    }
    .reason {
      color: var(--text-1);
      font-weight: 550;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--s-3);
      margin: var(--s-3) 0 0;
    }
    dl .wide {
      grid-column: 1 / -1;
    }
    dt {
      font-size: var(--fs-xs);
      color: var(--text-3);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    dd {
      margin: 2px 0 0;
      font-weight: 550;
    }
    .hash {
      display: flex;
      gap: 6px;
      align-items: center;
      min-width: 0;
    }
    .hash code {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text-2);
    }
    .copy {
      flex: none;
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 50%;
      background: var(--neutral-bg);
      color: var(--text-2);
      cursor: pointer;
    }
    @media (max-width: 480px) {
      .result {
        flex-direction: column;
      }
    }
    @keyframes in {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .result {
        animation: none;
      }
    }
  `,
})
export class CertificateVerifyWidget {
  /** Pre-fills and verifies immediately (the /verify/:no route). */
  readonly initialNumber = input<string>();

  private readonly api = inject(PublicApi);
  protected readonly icons = { QrCode, Copy };
  protected readonly number = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<PublicCertificateVerification | null>(null);

  protected readonly tone = computed(() => {
    switch (this.result()?.status) {
      case 'Valid':
        return 'success';
      case 'Revoked':
        return 'warning';
      case 'Invalid':
        return 'danger';
      default:
        return 'neutral';
    }
  });
  protected readonly resultIcon = computed(() => {
    switch (this.result()?.status) {
      case 'Valid':
        return BadgeCheck;
      case 'Revoked':
        return ShieldAlert;
      case 'Invalid':
        return ShieldX;
      default:
        return SearchX;
    }
  });
  protected readonly headline = computed(() => {
    switch (this.result()?.status) {
      case 'Valid':
        return 'Data securely wiped';
      case 'Revoked':
        return 'This certificate was revoked';
      case 'Invalid':
        return "This certificate doesn't check out";
      default:
        return 'No certificate with this number';
    }
  });

  constructor() {
    effect(() => {
      const initial = this.initialNumber();
      if (!initial) return;
      untracked(() => {
        this.number.setValue(initial);
        void this.verify();
      });
    });
  }

  async verify(): Promise<void> {
    this.number.markAsTouched();
    if (this.number.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      this.result.set(await firstValueFrom(this.api.verifyCertificate(this.number.value)));
    } catch (e) {
      this.result.set(null);
      this.error.set(errorMessage(e, 'Could not verify the certificate right now.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected methodLabel(r: PublicCertificateVerification): string {
    return r.method ? SANITIZATION_METHOD_LABELS[r.method] : '—';
  }
  protected issued(r: PublicCertificateVerification): string {
    return formatDateTime(r.issuedAt);
  }
  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text);
  }
}
