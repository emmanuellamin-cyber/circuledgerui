import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  KeyRound,
  LucideAngularModule,
  Mail,
  Phone,
  ShoppingBag,
  Smartphone,
  UserRound,
} from 'lucide-angular';
import { isApiError } from '../../core/api/api-error';
import { applyProblemToForm } from '../../core/api/problem-mapping';
import type { Gender } from '../../core/api/types';
import { AuthService } from '../../core/auth/auth.service';
import { homePathFor } from '../../core/auth/roles';
import {
  BrandMark,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassSelect,
  GlassTab,
  GlassTabs,
  SelectOption,
} from '../../shared/ui';

type AccountType = 'Buyer' | 'Citizen';

/** §8.1: ≥ 10 chars with upper-case, lower-case and a digit. */
export function strongPassword(c: AbstractControl<string>): ValidationErrors | null {
  const v = c.value ?? '';
  if (!v) return null;
  const missing: string[] = [];
  if (v.length < 10) missing.push('at least 10 characters');
  if (!/[A-Z]/.test(v)) missing.push('an upper-case letter');
  if (!/[a-z]/.test(v)) missing.push('a lower-case letter');
  if (!/\d/.test(v)) missing.push('a digit');
  return missing.length ? { password: `Password needs ${missing.join(', ')}.` } : null;
}

const GENDERS: SelectOption<Gender>[] = [
  { value: 'Unspecified', label: 'Prefer not to say' },
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
  { value: 'Other', label: 'Other' },
];

@Component({
  selector: 'register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    GlassCard,
    GlassInput,
    GlassSelect,
    GlassButton,
    GlassTabs,
    BrandMark,
  ],
  template: `
    <section class="wrap container">
      <glass-card variant="strong" padding="lg" class="card" [lens]="true">
        <div class="head">
          <brand-mark [wordmark]="false" [size]="44" />
          <h1>Create an account</h1>
          <p class="muted">Staff accounts are created by a Hub administrator.</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
          <div class="type">
            <p class="label">I want to</p>
            <glass-tabs
              #typeTabs="glassTabs"
              [tabs]="types"
              [selected]="accountType()"
              (selectedChange)="setType($event)"
              ariaLabel="Account type"
            />
            <p
              class="subtle small"
              role="tabpanel"
              [id]="typeTabs.panelId"
              [attr.aria-labelledby]="typeTabs.tabId(accountType())"
            >
              @if (accountType() === 'Buyer') {
                Buy certified refurbished phones and parts, and track my orders.
              } @else {
                Sell phones and follow my requests. Use the number you dial the USSD code from, so
                your earlier requests appear in your account.
              }
            </p>
          </div>

          <glass-input
            label="Full name"
            formControlName="fullName"
            autocomplete="name"
            [icon]="i.UserRound"
            [maxlength]="150"
            [required]="true"
          />
          <glass-input
            label="Email"
            type="email"
            formControlName="email"
            autocomplete="email"
            [icon]="i.Mail"
            [required]="true"
          />
          @if (accountType() === 'Citizen') {
            <glass-input
              label="Phone number"
              type="tel"
              formControlName="phone"
              autocomplete="tel"
              inputmode="tel"
              placeholder="076 123 456"
              hint="Local (076123456) or international (+23276123456) format."
              [icon]="i.Phone"
              [required]="true"
            />
          }
          <glass-input
            label="Password"
            type="password"
            formControlName="password"
            autocomplete="new-password"
            hint="At least 10 characters with upper-case, lower-case and a digit."
            [icon]="i.KeyRound"
            [required]="true"
          />
          <glass-select
            label="Gender"
            formControlName="gender"
            [options]="genders"
            hint="Helps us report on women's inclusion. Optional."
          />

          @if (formError(); as e) {
            <p class="form-error" role="alert">{{ e }}</p>
          }
          <button
            glass-button
            variant="primary"
            size="lg"
            type="submit"
            [block]="true"
            [loading]="loading()"
          >
            Create account
          </button>
        </form>

        <p class="foot muted">Already have an account? <a routerLink="/login">Log in</a></p>
      </glass-card>
    </section>
  `,
  styles: `
    .wrap {
      display: grid;
      justify-items: center;
      padding-block: clamp(24px, 6vw, 72px);
    }
    .card {
      width: 100%;
      max-width: 480px;
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
    }
    .type {
      display: grid;
      gap: var(--s-2);
    }
    .label {
      font-size: var(--fs-sm);
      font-weight: 600;
    }
    .small {
      font-size: var(--fs-xs);
    }
    .foot {
      margin-top: var(--s-5);
      text-align: center;
      font-size: var(--fs-sm);
    }
  `,
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly i = { Mail, KeyRound, UserRound, Phone };
  protected readonly genders = GENDERS;
  protected readonly types: GlassTab<AccountType>[] = [
    { id: 'Buyer', label: 'Buy phones', icon: ShoppingBag },
    { id: 'Citizen', label: 'Sell phones', icon: Smartphone },
  ];

  protected readonly form = new FormGroup({
    accountType: new FormControl<AccountType>('Buyer', { nonNullable: true }),
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    phone: new FormControl('', { nonNullable: true }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, strongPassword],
    }),
    gender: new FormControl<Gender>('Unspecified', { nonNullable: true }),
  });
  protected readonly accountType = toSignal(this.form.controls.accountType.valueChanges, {
    initialValue: this.form.controls.accountType.value,
  });
  protected readonly loading = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected setType(type: AccountType): void {
    this.form.controls.accountType.setValue(type);
    const phone = this.form.controls.phone;
    phone.setValidators(type === 'Citizen' ? [Validators.required] : []);
    phone.updateValueAndValidity();
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.loading.set(true);
    this.formError.set(null);
    try {
      const user = await this.auth.register({
        email: v.email.trim(),
        password: v.password,
        fullName: v.fullName.trim(),
        gender: v.gender,
        accountType: v.accountType,
        phone: v.accountType === 'Citizen' ? v.phone.trim() : null,
      });
      await this.router.navigateByUrl(homePathFor(user.roles));
    } catch (e) {
      if (isApiError(e) && e.status === 400) {
        const general = applyProblemToForm(this.form, e);
        this.formError.set(general.length ? general.join(' ') : null);
      } else {
        this.formError.set(e instanceof Error ? e.message : 'Could not create the account.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
