import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  Clock,
  KeyRound,
  Lock,
  LogIn,
  LucideAngularModule,
  Mail,
  TriangleAlert,
} from 'lucide-angular';
import { environment } from '../../../environments/environment';
import { isApiError } from '../../core/api/api-error';
import { applyProblemToForm } from '../../core/api/problem-mapping';
import type { Role } from '../../core/api/types';
import { AuthService } from '../../core/auth/auth.service';
import {
  ROLE_LABELS,
  WORKSPACES,
  hasAnyRole,
  homePathFor,
  safeReturnUrl,
} from '../../core/auth/roles';
import { BrandMark, GlassButton, GlassCard, GlassInput } from '../../shared/ui';

interface DemoAccount {
  email: string;
  role: Role;
  password: string;
}

/** §2 demo accounts. Only rendered when `environment.showDemoAccounts` (development builds). */
const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { email: 'admin@circuledger.local', role: 'Admin', password: 'ChangeMe!Admin2026' },
  { email: 'ops@circuledger.local', role: 'OperationsLead', password: 'ChangeMe!Demo2026' },
  { email: 'tech@circuledger.local', role: 'Technician', password: 'ChangeMe!Demo2026' },
  { email: 'agent@circuledger.local', role: 'FieldAgent', password: 'ChangeMe!Demo2026' },
  { email: 'buyer@circuledger.local', role: 'Buyer', password: 'ChangeMe!Demo2026' },
];

const MAX_ATTEMPTS = 5;

@Component({
  selector: 'login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    GlassCard,
    GlassInput,
    GlassButton,
    BrandMark,
  ],
  template: `
    <section class="wrap container">
      <glass-card variant="strong" padding="lg" class="card" [lens]="true">
        <div class="head">
          <brand-mark [wordmark]="false" [size]="44" />
          <h1>Log in</h1>
          <p class="muted">Staff, buyers and registered sellers sign in here.</p>
        </div>

        @if (reason() === 'expired' && !locked()) {
          <p class="banner info" role="status">
            <lucide-icon [img]="i.Clock" [size]="18" aria-hidden="true" />
            Your session expired. Please log in again.
          </p>
        }
        @if (locked() || reason() === 'locked') {
          <p class="banner warn" role="alert">
            <lucide-icon [img]="i.Lock" [size]="18" aria-hidden="true" />
            <span>
              <strong>Account temporarily locked.</strong> After {{ maxAttempts }} wrong passwords
              the account is locked for 15 minutes. Try again later.
            </span>
          </p>
        } @else if (formError(); as e) {
          <p class="form-error" role="alert">
            <lucide-icon [img]="i.TriangleAlert" [size]="18" aria-hidden="true" />
            <span>
              {{ e }}
              @if (attemptsLeft() !== null) {
                <br /><small
                  >{{ attemptsLeft() }} attempt{{ attemptsLeft() === 1 ? '' : 's' }} left before a
                  15-minute lock.</small
                >
              }
            </span>
          </p>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
          <glass-input
            label="Email"
            type="email"
            formControlName="email"
            autocomplete="username"
            [icon]="i.Mail"
            [required]="true"
          />
          <glass-input
            label="Password"
            type="password"
            formControlName="password"
            autocomplete="current-password"
            [icon]="i.KeyRound"
            [required]="true"
          />
          <button
            glass-button
            variant="primary"
            size="lg"
            type="submit"
            [block]="true"
            [loading]="loading()"
          >
            <lucide-icon [img]="i.LogIn" [size]="18" aria-hidden="true" /> Log in
          </button>
        </form>

        <p class="foot muted">
          New here? <a routerLink="/register">Create a buyer or seller account</a>
        </p>
      </glass-card>

      @if (showDemo) {
        <glass-card
          variant="subtle"
          padding="sm"
          class="demo"
          heading="Demo accounts"
          subheading="Development build only. Tap to fill the form."
        >
          <ul>
            @for (a of demo; track a.email) {
              <li>
                <button type="button" class="demo-btn" (click)="fill(a)">
                  <strong>{{ roleLabels[a.role] }}</strong>
                  <span class="mono">{{ a.email }}</span>
                </button>
              </li>
            }
          </ul>
        </glass-card>
      }
    </section>
  `,
  styles: `
    .wrap {
      display: grid;
      justify-items: center;
      gap: var(--s-4);
      padding-block: clamp(24px, 6vw, 72px);
    }
    .card {
      width: 100%;
      max-width: 440px;
    }
    .head {
      display: grid;
      justify-items: center;
      gap: var(--s-2);
      text-align: center;
      margin-bottom: var(--s-5);
    }
    .head p {
      font-size: var(--fs-sm);
    }
    .stack {
      --stack-gap: var(--s-4);
      margin-top: var(--s-4);
    }
    .banner {
      display: flex;
      gap: var(--s-2);
      align-items: flex-start;
      padding: var(--s-3) var(--s-4);
      border-radius: var(--r-sm);
      font-size: var(--fs-sm);
      font-weight: 500;
    }
    .banner.info {
      background: var(--info-bg);
      color: var(--info);
    }
    .banner.warn {
      background: var(--warning-bg);
      color: var(--warning);
    }
    .foot {
      margin-top: var(--s-5);
      text-align: center;
      font-size: var(--fs-sm);
    }
    .demo {
      width: 100%;
      max-width: 440px;
    }
    .demo ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 4px;
    }
    .demo-btn {
      display: flex;
      justify-content: space-between;
      gap: var(--s-2);
      width: 100%;
      min-height: var(--touch);
      padding: 8px 12px;
      border: 0;
      border-radius: var(--r-sm);
      background: transparent;
      color: var(--text-1);
      font-size: var(--fs-sm);
      text-align: left;
      cursor: pointer;
    }
    .demo-btn:hover {
      background: var(--neutral-bg);
    }
    .demo-btn .mono {
      color: var(--text-2);
      font-size: var(--fs-xs);
      align-self: center;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class Login {
  readonly returnUrl = input<string>();
  readonly reason = input<string>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly i = { Mail, KeyRound, LogIn, Lock, Clock, TriangleAlert };
  protected readonly showDemo = environment.showDemoAccounts;
  protected readonly demo = DEMO_ACCOUNTS;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly maxAttempts = MAX_ATTEMPTS;

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly loading = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly locked = signal(false);
  /** Client-side count for a friendly warning only; the API is the authority on lockout. */
  private readonly failures = signal(0);
  protected readonly attemptsLeft = computed(() => {
    const n = this.failures();
    return n >= 2 && n < MAX_ATTEMPTS ? MAX_ATTEMPTS - n : null;
  });

  protected fill(a: DemoAccount): void {
    this.form.setValue({ email: a.email, password: a.password });
    this.formError.set(null);
    this.locked.set(false);
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading.set(true);
    this.formError.set(null);
    try {
      const user = await this.auth.login(this.form.getRawValue());
      this.failures.set(0);
      await this.router.navigateByUrl(this.destinationFor(user.roles));
    } catch (e) {
      if (isApiError(e) && e.status === 401) {
        // §2: 401 = wrong credentials, inactive or locked. Lockout detail says "temporarily locked".
        const detail = (e.problem.detail ?? e.problem.title ?? '').toLowerCase();
        if (detail.includes('locked')) {
          this.locked.set(true);
        } else {
          this.failures.update((n) => n + 1);
          this.formError.set(e.problem.detail ?? 'Email or password is incorrect.');
        }
      } else if (isApiError(e) && e.status === 400) {
        const general = applyProblemToForm(this.form, e);
        this.formError.set(general.join(' ') || null);
      } else if (isApiError(e) && e.status === 429) {
        this.formError.set(
          'Too many sign-in attempts from this network. Wait a minute and try again.',
        );
      } else {
        this.formError.set(e instanceof Error ? e.message : 'Could not sign in.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  /** Honour `returnUrl` only when the user's roles can open that workspace. */
  private destinationFor(roles: readonly Role[]): string {
    const back = safeReturnUrl(this.returnUrl());
    if (back) {
      const ws = WORKSPACES.find((w) => back === w.path || back.startsWith(`${w.path}/`));
      if (!ws || hasAnyRole(roles, ws.roles)) return back;
    }
    return homePathFor(roles);
  }
}
