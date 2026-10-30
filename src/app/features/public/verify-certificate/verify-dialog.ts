import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GlassModal } from '../../../shared/ui';
import { CertificateVerifyWidget } from './certificate-verify-widget';

/** Certificate check in a glass modal (used by the simulators). */
@Component({
  selector: 'verify-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GlassModal, CertificateVerifyWidget],
  template: `
    <glass-modal heading="Verify certificate" (closed)="ref.close()">
      <certificate-verify-widget [initialNumber]="certificateNumber" />
    </glass-modal>
  `,
})
export class VerifyDialog {
  protected readonly certificateNumber = inject<string>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
}
