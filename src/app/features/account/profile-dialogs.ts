import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { KeyRound, LucideAngularModule, Mail, Phone } from 'lucide-angular';
import { ProfileApi } from '../../core/api/profile.api';
import type { UserProfile } from '../../core/api/types';
import { Action, useAction } from '../../core/state/action';
import { GlassButton, GlassInput, GlassModal, ModalService } from '../../shared/ui';
import { strongPassword } from '../auth/register';

/**
 * Error keys from the profile endpoints that aren't control names (PROFILE_MANAGEMENT.md §5).
 * Identity password codes all belong to the new password field.
 */
export const PROFILE_ALIASES: Readonly<Record<string, string>> = {
  duplicateEmail: 'newEmail',
  duplicateUserName: 'newEmail',
  invalidEmail: 'newEmail',
  invalidUserName: 'newEmail',
  passwordTooShort: 'newPassword',
  passwordRequiresUpper: 'newPassword',
  passwordRequiresLower: 'newPassword',
  passwordRequiresDigit: 'newPassword',
  passwordRequiresNonAlphanumeric: 'newPassword',
  passwordRequiresUniqueChars: 'newPassword',
};

/** Light client check (§4.3): at least 8 digits. The server does the real validation. */
export function phoneDigits(c: AbstractControl<string>): ValidationErrors | null {
  const digits = (c.value ?? '').replace(/\D/g, '');
  return !c.value || digits.length >= 8 ? null : { phone: 'Enter at least 8 digits.' };
}

/**
 * Runs a change that needs the current password (§7): the password is cleared after every
 * attempt, 429 shows a wait message and a locked account (401) lands on the login page.
 */
async function runWithPassword<T>(
  action: Action,
  form: FormGroup,
  router: Router,
  ref: { close(): void },
  work: () => Promise<T>,
): Promise<T | undefined> {
  const pending = work();
  form.get('currentPassword')?.reset('');
  const result = await action.run(() => pending, { form, aliases: PROFILE_ALIASES });
  if (action.status() === 429) {
    action.error.set('Too many attempts. Wait a minute and try again.');
  } else if (action.status() === 401) {
    // The interceptor already cleared the session; explain the lockout on the login page.
    ref.close();
    await router.navigate(['/login'], { queryParams: { reason: 'locked' } });
  }
  return result;
}

// ---------------------------------------------------------------------------------------------

/** §4.2 PUT /users/me/email */
@Component({
  selector: 'change-email-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassButton],
  template: `
    <glass-modal
      heading="Change email"
      description="You'll sign in with the new email from now on."
      (closed)="ref.close()"
    >
      <form id="email-form" [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
        <glass-input
          label="New email"
          type="email"
          formControlName="newEmail"
          autocomplete="email"
          [icon]="i.Mail"
          [maxlength]="256"
          [required]="true"
        />
        <glass-input
          label="Current password"
          type="password"
          formControlName="currentPassword"
          autocomplete="current-password"
          [icon]="i.KeyRound"
          [required]="true"
        />
        @if (action.error(); as e) {
          <p class="form-error" role="alert">{{ e }}</p>
        }
      </form>
      <ng-container modal-footer>
        <button glass-button variant="ghost" type="button" (click)="ref.close()">Cancel</button>
        <button
          glass-button
          variant="primary"
          type="submit"
          form="email-form"
          [loading]="action.busy()"
        >
          Change email
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class ChangeEmailDialog {
  protected readonly data = inject<UserProfile>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<UserProfile>>(DialogRef);
  private readonly profile = inject(ProfileApi);
  private readonly router = inject(Router);
  protected readonly action = useAction();
  protected readonly i = { Mail, KeyRound };

  private readonly notCurrent = (c: AbstractControl<string>): ValidationErrors | null =>
    c.value.trim().toLowerCase() === this.data.email.toLowerCase()
      ? { same: 'This is already your email.' }
      : null;

  protected readonly form = new FormGroup({
    newEmail: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.email,
        Validators.maxLength(256),
        this.notCurrent,
      ],
    }),
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const user = await runWithPassword(this.action, this.form, this.router, this.ref, () =>
      this.profile.changeEmail({ newEmail: v.newEmail.trim(), currentPassword: v.currentPassword }),
    );
    if (user) this.ref.close(user);
  }
}

// ---------------------------------------------------------------------------------------------

export interface ChangePhoneData {
  profile: UserProfile;
  /** Citizens see the §6 warning: requests from the old number leave their account. */
  isCitizen: boolean;
}

/** §4.3 PUT /users/me/phone */
@Component({
  selector: 'change-phone-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassButton],
  template: `
    <glass-modal
      [heading]="data.profile.maskedPhone ? 'Change phone number' : 'Add phone number'"
      [description]="data.profile.maskedPhone ? 'Current: ' + data.profile.maskedPhone : undefined"
      (closed)="ref.close()"
    >
      <form id="phone-form" [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
        <glass-input
          label="New phone number"
          type="tel"
          inputmode="tel"
          formControlName="phone"
          autocomplete="tel"
          placeholder="076 123 456"
          hint="+232XXXXXXXX, 0XXXXXXXX or 8 local digits. Spaces and dashes are fine."
          [icon]="i.Phone"
          [required]="true"
        />
        <glass-input
          label="Current password"
          type="password"
          formControlName="currentPassword"
          autocomplete="current-password"
          [icon]="i.KeyRound"
          [required]="true"
        />
        @if (action.error(); as e) {
          <p class="form-error" role="alert">{{ e }}</p>
        }
      </form>
      <ng-container modal-footer>
        <button glass-button variant="ghost" type="button" (click)="ref.close()">Cancel</button>
        <button
          glass-button
          variant="primary"
          type="submit"
          form="phone-form"
          [loading]="action.busy()"
        >
          Save phone
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class ChangePhoneDialog {
  protected readonly data = inject<ChangePhoneData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<UserProfile>>(DialogRef);
  private readonly profile = inject(ProfileApi);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  protected readonly action = useAction();
  protected readonly i = { Phone, KeyRound };

  protected readonly form = new FormGroup({
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, phoneDigits],
    }),
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    if (this.data.isCitizen && !(await this.confirmCitizenChange())) return;
    const user = await runWithPassword(this.action, this.form, this.router, this.ref, () =>
      this.profile.changePhone({ phone: v.phone.trim(), currentPassword: v.currentPassword }),
    );
    if (user) this.ref.close(user);
  }

  /** §6: the old number is released and its sell requests leave the account. */
  private confirmCitizenChange(): Promise<boolean> {
    const old = this.data.profile.maskedPhone;
    return this.modal.confirm({
      title: 'Change your phone number?',
      message: old
        ? `Sell requests you made from ${old} will no longer appear in your account. Requests you make by USSD or SMS from the new number will.`
        : 'Requests you make by USSD or SMS from this number will appear in your account.',
      confirmLabel: 'Change number',
      danger: !!old,
    });
  }
}

// ---------------------------------------------------------------------------------------------

/** New ≠ current and confirmation matches (§4.4). */
function passwordPair(g: AbstractControl): ValidationErrors | null {
  const { currentPassword, newPassword, confirmPassword } = (
    g as FormGroup<{
      currentPassword: FormControl<string>;
      newPassword: FormControl<string>;
      confirmPassword: FormControl<string>;
    }>
  ).controls;
  setOwnError(
    confirmPassword,
    'mismatch',
    !!confirmPassword.value && confirmPassword.value !== newPassword.value
      ? "Passwords don't match."
      : null,
  );
  setOwnError(
    newPassword,
    'same',
    !!newPassword.value && newPassword.value === currentPassword.value
      ? 'Choose a password different from your current one.'
      : null,
  );
  return null;
}

/** Adds or removes one cross-field error key without touching the control's other errors. */
function setOwnError(c: AbstractControl, key: string, message: string | null): void {
  const rest = { ...(c.errors ?? {}) };
  delete rest[key];
  const next = message ? { ...rest, [key]: message } : rest;
  c.setErrors(Object.keys(next).length ? next : null);
}

/** §4.4 PUT /users/me/password: stores the new tokens, other devices are signed out. */
@Component({
  selector: 'change-password-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassButton, LucideAngularModule],
  template: `
    <glass-modal
      heading="Change password"
      description="You'll be signed out on your other devices. This tab stays signed in."
      (closed)="ref.close()"
    >
      <form id="password-form" [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
        <glass-input
          label="Current password"
          type="password"
          formControlName="currentPassword"
          autocomplete="current-password"
          [icon]="i.KeyRound"
          [required]="true"
        />
        <glass-input
          label="New password"
          type="password"
          formControlName="newPassword"
          autocomplete="new-password"
          hint="At least 10 characters with upper-case, lower-case and a digit."
          [icon]="i.KeyRound"
          [maxlength]="128"
          [required]="true"
        />
        <glass-input
          label="Confirm new password"
          type="password"
          formControlName="confirmPassword"
          autocomplete="new-password"
          [icon]="i.KeyRound"
          [maxlength]="128"
          [required]="true"
        />
        @if (action.error(); as e) {
          <p class="form-error" role="alert">{{ e }}</p>
        }
      </form>
      <ng-container modal-footer>
        <button glass-button variant="ghost" type="button" (click)="ref.close()">Cancel</button>
        <button
          glass-button
          variant="primary"
          type="submit"
          form="password-form"
          [loading]="action.busy()"
        >
          Change password
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class ChangePasswordDialog {
  protected readonly ref = inject<DialogRef<UserProfile>>(DialogRef);
  private readonly profile = inject(ProfileApi);
  private readonly router = inject(Router);
  protected readonly action = useAction();
  protected readonly i = { KeyRound };

  protected readonly form = new FormGroup(
    {
      currentPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(128), strongPassword],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordPair },
  );

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const user = await runWithPassword(this.action, this.form, this.router, this.ref, () =>
      this.profile.changePassword({
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      }),
    );
    if (user) this.ref.close(user);
  }
}
