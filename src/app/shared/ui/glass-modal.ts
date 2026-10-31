import { Dialog, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  inject,
  input,
  output,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LucideAngularModule, TriangleAlert, X } from 'lucide-angular';
import { GlassButton } from './glass-button';

/**
 * Presentational shell for dialog content: title, optional description, close button,
 * body and a `[modal-footer]` slot. Open it through CDK Dialog (focus trap, Esc, focus
 * restore and aria-modal come from the CDK).
 */
@Component({
  selector: 'glass-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'glass glass--strong glass--lens' },
  template: `
    <header class="head">
      <div class="titles">
        <h2 class="title" [id]="titleId()">{{ heading() }}</h2>
        @if (description()) {
          <p class="muted">{{ description() }}</p>
        }
      </div>
      <button type="button" class="close" aria-label="Close dialog" (click)="closed.emit()">
        <lucide-icon [img]="X" [size]="20" />
      </button>
    </header>
    <div class="body"><ng-content /></div>
    <footer class="foot"><ng-content select="[modal-footer]" /></footer>
  `,
  styles: `
    :host {
      display: block;
      padding: var(--s-5);
      border-radius: var(--r-xl);
      max-height: calc(100dvh - 48px);
      overflow: auto;
      animation: pop var(--dur-3) var(--ease-spring);
    }
    .head {
      display: flex;
      gap: var(--s-3);
      align-items: flex-start;
      justify-content: space-between;
    }
    .titles {
      display: grid;
      gap: 4px;
    }
    .title {
      font-size: var(--fs-xl);
    }
    .close {
      flex: none;
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: var(--r-pill);
      background: var(--neutral-bg);
      color: var(--text-2);
      cursor: pointer;
    }
    .body {
      margin-top: var(--s-4);
    }
    .foot {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: var(--s-2);
      margin-top: var(--s-5);
    }
    .foot:empty {
      display: none;
    }
    @keyframes pop {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.97);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
  `,
})
export class GlassModal {
  readonly heading = input.required<string>();
  readonly description = input<string>();
  readonly titleId = input('glass-modal-title');
  readonly closed = output<void>();
  protected readonly X = X;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions get a red confirm button and a warning icon. */
  danger?: boolean;
}

@Component({
  selector: 'glass-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GlassModal, GlassButton, LucideAngularModule],
  template: `
    <glass-modal [heading]="data.title" titleId="confirm-title" (closed)="ref.close(false)">
      <div class="msg">
        @if (data.danger) {
          <lucide-icon class="warn" [img]="TriangleAlert" [size]="22" aria-hidden="true" />
        }
        <p>{{ data.message }}</p>
      </div>
      <ng-container modal-footer>
        <button glass-button variant="ghost" type="button" (click)="ref.close(false)">
          {{ data.cancelLabel ?? 'Cancel' }}
        </button>
        <button
          glass-button
          type="button"
          [variant]="data.danger ? 'danger' : 'primary'"
          (click)="ref.close(true)"
          cdkFocusInitial
        >
          {{ data.confirmLabel ?? 'Confirm' }}
        </button>
      </ng-container>
    </glass-modal>
  `,
  styles: `
    .msg {
      display: flex;
      gap: var(--s-3);
      align-items: flex-start;
      color: var(--text-2);
    }
    .warn {
      color: var(--danger);
      margin-top: 2px;
    }
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmOptions>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly TriangleAlert = TriangleAlert;
}

/** Opens glass dialogs with consistent backdrop/panel styling. */
@Injectable({ providedIn: 'root' })
export class ModalService {
  private readonly dialog = inject(Dialog);

  open<R, D = unknown, C = unknown>(
    component: ComponentType<C>,
    data?: D,
    labelledBy = 'glass-modal-title',
    /** `narrow` (440px) suits single-column forms; the default is 560px. */
    size: 'default' | 'narrow' = 'default',
  ): DialogRef<R, C> {
    return this.dialog.open<R, D, C>(component, {
      data,
      backdropClass: 'cl-modal-backdrop',
      panelClass:
        size === 'narrow' ? ['cl-modal-panel', 'cl-modal-panel--narrow'] : 'cl-modal-panel',
      ariaLabelledBy: labelledBy,
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
  }

  /** Resolves true only when the user explicitly confirms. */
  async confirm(options: ConfirmOptions): Promise<boolean> {
    const ref = this.open<boolean, ConfirmOptions, ConfirmDialog>(
      ConfirmDialog,
      options,
      'confirm-title',
    );
    return (await firstValueFrom(ref.closed)) === true;
  }
}
