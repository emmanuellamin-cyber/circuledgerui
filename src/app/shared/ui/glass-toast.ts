import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  CircleCheck,
  CircleX,
  Info,
  LucideAngularModule,
  LucideIconData,
  TriangleAlert,
  X,
} from 'lucide-angular';
import { ApiError, isApiError } from '../../core/api/api-error';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  title?: string;
  message: string;
  /** Shown for errors so users can quote it in "report a problem" (§3). */
  traceId?: string;
}

let nextId = 0;

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<readonly Toast[]>([]);

  show(
    message: string,
    tone: ToastTone = 'info',
    opts: { title?: string; traceId?: string; duration?: number } = {},
  ): void {
    const toast: Toast = { id: ++nextId, tone, message, title: opts.title, traceId: opts.traceId };
    this.toasts.update((list) => [...list.slice(-3), toast]);
    const duration = opts.duration ?? (tone === 'error' ? 8000 : 4500);
    if (duration > 0) setTimeout(() => this.dismiss(toast.id), duration);
  }

  success(message: string, title?: string): void {
    this.show(message, 'success', { title });
  }

  /** Shows `problem.detail` and the trace id for API errors. */
  error(e: unknown, fallback = 'Something went wrong.'): void {
    if (isApiError(e)) {
      const err: ApiError = e;
      this.show(err.message || fallback, err.status === 429 ? 'warning' : 'error', {
        title:
          err.problem.title && err.problem.title !== err.message ? err.problem.title : undefined,
        traceId: err.status >= 500 ? err.traceId : undefined,
      });
      return;
    }
    this.show(e instanceof Error ? e.message : fallback, 'error');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}

const ICONS: Record<ToastTone, LucideIconData> = {
  success: CircleCheck,
  error: CircleX,
  warning: TriangleAlert,
  info: Info,
};

/** One toast. Errors use role="alert" (assertive); the rest are polite status messages. */
@Component({
  selector: 'glass-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: {
    class: 'glass glass--strong',
    '[attr.role]': "toast().tone === 'error' ? 'alert' : 'status'",
    '[class]': "'glass glass--strong tone-' + toast().tone",
  },
  template: `
    <lucide-icon class="icon" [img]="icon()" [size]="20" aria-hidden="true" />
    <div class="text">
      @if (toast().title) {
        <strong>{{ toast().title }}</strong>
      }
      <p>{{ toast().message }}</p>
      @if (toast().traceId) {
        <p class="trace">
          Trace ID: <code>{{ toast().traceId }}</code>
        </p>
      }
    </div>
    <button
      type="button"
      class="close"
      aria-label="Dismiss notification"
      (click)="dismissed.emit()"
    >
      <lucide-icon [img]="X" [size]="16" />
    </button>
  `,
  styles: `
    :host {
      display: flex;
      gap: var(--s-3);
      align-items: flex-start;
      width: min(400px, calc(100vw - 32px));
      padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4);
      border-radius: var(--r-lg);
      animation: in var(--dur-3) var(--ease-spring);
    }
    .icon {
      margin-top: 2px;
    }
    :host(.tone-success) .icon {
      color: var(--success);
    }
    :host(.tone-error) .icon {
      color: var(--danger);
    }
    :host(.tone-warning) .icon {
      color: var(--warning);
    }
    :host(.tone-info) .icon {
      color: var(--info);
    }
    .text {
      flex: 1;
      display: grid;
      gap: 2px;
      font-size: var(--fs-sm);
    }
    .trace {
      color: var(--text-3);
      font-size: var(--fs-xs);
    }
    .close {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: var(--r-pill);
      background: transparent;
      color: var(--text-2);
      cursor: pointer;
    }
    .close:hover {
      background: var(--neutral-bg);
    }
    @keyframes in {
      from {
        opacity: 0;
        transform: translateY(-10px) scale(0.96);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
  `,
})
export class GlassToast {
  readonly toast = input.required<Toast>();
  readonly dismissed = output<void>();
  protected readonly X = X;
  protected icon(): LucideIconData {
    return ICONS[this.toast().tone];
  }
}

/** Place once in the app root. */
@Component({
  selector: 'glass-toast-stack',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GlassToast],
  host: { 'aria-live': 'polite', 'aria-relevant': 'additions' },
  template: `
    @for (t of toasts.toasts(); track t.id) {
      <glass-toast [toast]="t" (dismissed)="toasts.dismiss(t.id)" />
    }
  `,
  styles: `
    :host {
      position: fixed;
      top: max(16px, env(safe-area-inset-top));
      right: 16px;
      z-index: var(--z-toast);
      display: grid;
      gap: var(--s-2);
      pointer-events: none;
    }
    :host > * {
      pointer-events: auto;
    }
    @media (max-width: 600px) {
      :host {
        left: 16px;
        right: 16px;
        justify-items: center;
      }
    }
  `,
})
export class GlassToastStack {
  protected readonly toasts = inject(ToastService);
}
