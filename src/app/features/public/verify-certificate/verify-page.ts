import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GlassCard } from '../../../shared/ui';
import { CertificateVerifyWidget } from './certificate-verify-widget';

/**
 * /verify and /verify/:certificateNumber. If the backend sets `Hub:PublicBaseUrl` to this app,
 * the QR code on the certificate PDF can point here (§8.3).
 */
@Component({
  selector: 'verify-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GlassCard, CertificateVerifyWidget],
  template: `
    <section class="container section">
      <div class="section-head">
        <p class="eyebrow">Certificate of Data Sanitization</p>
        <h1>Verify a certificate</h1>
        <p>
          Every phone the Hub buys is wiped before it is repaired, dismantled or resold. Enter the
          certificate number to check it was issued by the Hub and hasn't been changed.
        </p>
      </div>
      <glass-card padding="lg" class="card">
        <certificate-verify-widget [initialNumber]="certificateNumber()" />
      </glass-card>
    </section>
  `,
  styles: `
    .card {
      max-width: 760px;
    }
  `,
})
export class VerifyPage {
  /** Bound from the route param by withComponentInputBinding(). */
  readonly certificateNumber = input<string>();
}
