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
  Download,
  ExternalLink,
  LucideAngularModule,
  QrCode,
  ShieldCheck,
  ShieldX,
} from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { CertificatesApi } from '../../../core/api/commerce.api';
import type { Certificate } from '../../../core/api/types';
import { AuthService } from '../../../core/auth/auth.service';
import { POLICY } from '../../../core/auth/roles';
import { formatDateTime, relativeTime } from '../../../core/format/format';
import { useAction } from '../../../core/state/action';
import { urlQuery } from '../../../core/state/url-query';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  ModalService,
  PageHeader,
  Paginator,
  Skeleton,
  StatusPill,
} from '../../../shared/ui';
import { BreadcrumbService } from '../breadcrumb.service';
import { ReasonDialog, ReasonDialogData } from '../shared/ops-dialogs';

/** Certificates list, newest first (§8.11). */
@Component({
  selector: 'certificates-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    StatusPill,
    Paginator,
    Skeleton,
    EmptyState,
  ],
  template: `
    <page-header
      heading="Certificates"
      subheading="Certificates of Data Sanitization, digitally signed (RS256). Newest first."
    />
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
              Certificates
            </caption>
            <thead>
              <tr>
                <th scope="col">Certificate</th>
                <th scope="col">Device</th>
                <th scope="col">Issued</th>
                <th scope="col">Key</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (c of list.value()!.items; track c.id) {
                <tr>
                  <td data-label="Certificate">
                    <a
                      class="row-link mono"
                      [routerLink]="['/ops/certificates', c.certificateNumber]"
                      >{{ c.certificateNumber }}</a
                    >
                  </td>
                  <td data-label="Device">
                    <a class="mono" [routerLink]="['/ops/devices', c.deviceId]">{{
                      c.trackingId
                    }}</a>
                  </td>
                  <td data-label="Issued">{{ ago(c.issuedAt) }}</td>
                  <td data-label="Key" class="mono">
                    {{ c.signatureAlgorithm }} · {{ c.signingKeyId.slice(0, 8) }}
                  </td>
                  <td data-label="Status">
                    <status-pill [status]="c.isRevoked ? 'Revoked' : 'Valid'" />
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
            heading="No certificates yet"
            message="A certificate is issued automatically when a data wipe passes in the workshop."
            [icon]="ShieldCheck"
          />
        }
      </div>
    </glass-card>
  `,
})
export class CertificatesList {
  private readonly certs = inject(CertificatesApi);
  protected readonly ShieldCheck = ShieldCheck;
  protected readonly q = urlQuery({});
  protected readonly list = rxResource({
    params: () => this.q.page(),
    stream: ({ params: page }) => this.certs.list(page, 20),
  });
  protected readonly errorText = computed(() => errorMessage(this.list.error()));
  protected ago(v: string): string {
    return relativeTime(v);
  }
}

/** One certificate: details, QR preview (blob), PDF / QR download, revoke (Admin). */
@Component({
  selector: 'certificate-detail',
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
  template: `
    @if (cert.value(); as c) {
      <page-header [heading]="c.certificateNumber" subheading="Certificate of Data Sanitization">
        <ng-container page-actions>
          <a glass-button size="sm" routerLink="/ops/certificates"
            ><lucide-icon [img]="i.ArrowLeft" [size]="15" aria-hidden="true" /> All certificates</a
          >
          <button
            glass-button
            variant="primary"
            type="button"
            [loading]="pdf.busy()"
            (click)="downloadPdf(c)"
          >
            <lucide-icon [img]="i.Download" [size]="16" aria-hidden="true" /> PDF
          </button>
          <button glass-button type="button" [loading]="qr.busy()" (click)="downloadQr(c)">
            <lucide-icon [img]="i.QrCode" [size]="16" aria-hidden="true" /> QR label
          </button>
          @if (isAdmin() && !c.isRevoked) {
            <button glass-button variant="danger" type="button" (click)="revoke(c)">
              <lucide-icon [img]="i.ShieldX" [size]="16" aria-hidden="true" /> Revoke
            </button>
          }
        </ng-container>
      </page-header>
      @if (pdf.error() || qr.error(); as e) {
        <p class="form-error" role="alert">{{ e }}</p>
      }
      <div class="split">
        <glass-card heading="Details">
          <status-pill card-actions [status]="c.isRevoked ? 'Revoked' : 'Valid'" />
          <dl class="dl">
            <div>
              <dt>Device</dt>
              <dd>
                <a class="mono" [routerLink]="['/ops/devices', c.deviceId]">{{ c.trackingId }}</a>
              </dd>
            </div>
            <div>
              <dt>Issued</dt>
              <dd>{{ when(c.issuedAt) }}</dd>
            </div>
            <div>
              <dt>Algorithm</dt>
              <dd>{{ c.signatureAlgorithm }}</dd>
            </div>
            <div>
              <dt>Signing key</dt>
              <dd class="mono">{{ c.signingKeyId }}</dd>
            </div>
            <div class="wide">
              <dt>Payload hash</dt>
              <dd class="mono hash">{{ c.payloadHash }}</dd>
            </div>
            @if (c.isRevoked) {
              <div>
                <dt>Revoked</dt>
                <dd>{{ when(c.revokedAt) }}</dd>
              </div>
              <div class="wide">
                <dt>Reason</dt>
                <dd>{{ c.revocationReason }}</dd>
              </div>
            }
          </dl>
          <p class="links">
            <a [routerLink]="['/verify', c.certificateNumber]">Public verify page</a> ·
            <a [href]="c.verificationUrl" target="_blank" rel="noopener"
              >QR target URL <lucide-icon [img]="i.ExternalLink" [size]="13" aria-hidden="true"
            /></a>
          </p>
        </glass-card>
        <glass-card
          heading="QR code"
          subheading="For stickers and labels. Points to the verification URL."
        >
          @if (qrUrl(); as src) {
            <img
              class="qr"
              [src]="src"
              [alt]="'QR code for ' + c.certificateNumber"
              width="220"
              height="220"
            />
          } @else if (qrError()) {
            <p class="muted small">{{ qrError() }}</p>
          } @else {
            <skeleton width="220px" height="220px" radius="16px" />
          }
        </glass-card>
      </div>
    } @else if (cert.error()) {
      <empty-state heading="Certificate not found" [message]="errorText()">
        <a glass-button size="sm" routerLink="/ops/certificates">All certificates</a>
      </empty-state>
    } @else {
      <skeleton [lines]="6" />
    }
  `,
  styles: `
    .hash {
      font-size: var(--fs-xs);
      word-break: break-all;
    }
    .links {
      margin-top: var(--s-4);
      font-size: var(--fs-sm);
    }
    .qr {
      border-radius: 16px;
      background: #fff;
      padding: 10px;
    }
    .small {
      font-size: var(--fs-sm);
    }
    .form-error {
      margin-bottom: var(--s-3);
    }
  `,
})
export class CertificateDetail {
  readonly certificateNumber = input.required<string>();
  private readonly certs = inject(CertificatesApi);
  private readonly modal = inject(ModalService);
  private readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);
  protected readonly i = { ArrowLeft, Download, QrCode, ShieldX, ExternalLink };
  protected readonly pdf = useAction();
  protected readonly qr = useAction();
  protected readonly isAdmin = computed(() => this.auth.hasRole(...POLICY.Admin));

  protected readonly cert = rxResource({
    params: () => this.certificateNumber(),
    stream: ({ params: no }) => this.certs.get(no),
  });
  protected readonly qrUrl = signal<string | null>(null);
  protected readonly qrError = signal<string | null>(null);
  protected readonly errorText = computed(() => errorMessage(this.cert.error()));

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => this.crumbs.detail.set(this.certificateNumber()));
    // Protected image: blob fetch with the auth header, then an object URL (§5).
    effect(() => {
      const no = this.cert.value()?.certificateNumber;
      if (!no) return;
      this.certs
        .qrObjectUrl(no)
        .then((url) => {
          this.revokeUrl();
          this.qrUrl.set(url);
        })
        .catch((e: unknown) => this.qrError.set(errorMessage(e, "Couldn't load the QR code.")));
    });
    destroyRef.onDestroy(() => {
      this.revokeUrl();
      this.crumbs.detail.set(null);
    });
  }

  protected downloadPdf(c: Certificate): void {
    void this.pdf.run(() => this.certs.downloadPdf(c.certificateNumber));
  }
  protected downloadQr(c: Certificate): void {
    void this.qr.run(() => this.certs.downloadQr(c.certificateNumber));
  }
  protected revoke(c: Certificate): void {
    const data: ReasonDialogData = {
      title: `Revoke ${c.certificateNumber}?`,
      message:
        'Anyone verifying it, including buyers, will see it as revoked. This cannot be undone.',
      confirmLabel: 'Revoke certificate',
      danger: true,
      submit: (reason) => this.certs.revoke(c.certificateNumber, reason),
    };
    this.modal
      .open<Certificate>(ReasonDialog, data)
      .closed.subscribe((res) => res && this.cert.reload());
  }
  protected when(v: string | null): string {
    return formatDateTime(v);
  }
  private revokeUrl(): void {
    const u = this.qrUrl();
    if (u) URL.revokeObjectURL(u);
  }
}
