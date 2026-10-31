import { ComponentType } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { KeyRound, LucideAngularModule, Mail, Phone, UserRound } from 'lucide-angular';
import { errorMessage } from '../../core/api/api-error';
import { ProfileApi } from '../../core/api/profile.api';
import type { Gender, UserProfile } from '../../core/api/types';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE_LABELS } from '../../core/auth/roles';
import { formatDate } from '../../core/format/format';
import { useAction } from '../../core/state/action';
import {
  GlassButton,
  GlassCard,
  GlassInput,
  GlassSelect,
  ModalService,
  SelectOption,
  Skeleton,
  ToastService,
} from '../../shared/ui';
import {
  ChangeEmailDialog,
  ChangePasswordDialog,
  ChangePhoneData,
  ChangePhoneDialog,
} from './profile-dialogs';

const GENDERS: SelectOption<Gender>[] = [
  { value: 'Unspecified', label: 'Prefer not to say' },
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
  { value: 'Other', label: 'Other' },
];

/**
 * "My profile" for every role (PROFILE_MANAGEMENT.md §4): personal details, email, phone and
 * password, each saved on its own.
 */
@Component({
  selector: 'profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    LucideAngularModule,
    GlassCard,
    GlassInput,
    GlassSelect,
    GlassButton,
    Skeleton,
  ],
  template: `
    <section class="container section wrap">
      <div class="head">
        <p class="eyebrow">My profile</p>
        <h1>{{ profile()?.fullName ?? auth.user()?.fullName }}</h1>
        @if (profile(); as p) {
          <p class="muted">{{ roles() }} · Member since {{ since(p.createdAt) }}</p>
        }
      </div>

      @if (loadError(); as e) {
        <div class="form-error" role="alert">
          {{ e }}
          <button glass-button size="sm" type="button" (click)="load()">Retry</button>
        </div>
      } @else if (!profile()) {
        <skeleton [lines]="4" height="88px" />
      } @else {
        <glass-card heading="Personal details" padding="lg">
          <form [formGroup]="details" (ngSubmit)="saveDetails()" class="form-grid" novalidate>
            <glass-input
              label="Full name"
              formControlName="fullName"
              autocomplete="name"
              [icon]="i.UserRound"
              [maxlength]="150"
              [required]="true"
            />
            <glass-select
              label="Gender"
              formControlName="gender"
              [options]="genders"
              hint="Helps us report on women's inclusion."
            />
            @if (detailsAction.error(); as e) {
              <p class="form-error full" role="alert">{{ e }}</p>
            }
            <div class="full actions">
              <button
                glass-button
                variant="primary"
                type="submit"
                [loading]="detailsAction.busy()"
                [disabled]="details.pristine"
              >
                Save
              </button>
            </div>
          </form>
        </glass-card>

        <glass-card heading="Sign-in and contact" padding="lg">
          <ul class="rows">
            <li>
              <lucide-icon [img]="i.Mail" [size]="20" aria-hidden="true" />
              <div class="text">
                <span class="label">Email</span>
                <span class="value">{{ profile()!.email }}</span>
              </div>
              <button glass-button size="sm" type="button" (click)="changeEmail()">Change</button>
            </li>
            <li>
              <lucide-icon [img]="i.Phone" [size]="20" aria-hidden="true" />
              <div class="text">
                <span class="label">Phone</span>
                <span class="value mono">{{ profile()!.maskedPhone ?? 'No phone added' }}</span>
              </div>
              <button glass-button size="sm" type="button" (click)="changePhone()">
                {{ profile()!.maskedPhone ? 'Change' : 'Add' }}
              </button>
            </li>
            <li>
              <lucide-icon [img]="i.KeyRound" [size]="20" aria-hidden="true" />
              <div class="text">
                <span class="label">Password</span>
                <span class="value" aria-label="Hidden">••••••••••</span>
              </div>
              <button glass-button size="sm" type="button" (click)="changePassword()">
                Change
              </button>
            </li>
          </ul>
        </glass-card>
      }
    </section>
  `,
  styles: `
    .wrap {
      display: grid;
      gap: var(--s-4);
      max-width: 760px;
    }
    .head h1 {
      font-size: var(--fs-3xl);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
    }
    .rows li {
      display: flex;
      align-items: center;
      gap: var(--s-3);
      padding-block: var(--s-3);
      color: var(--text-2);
    }
    .rows li + li {
      border-top: 1px solid var(--field-border);
    }
    .text {
      display: grid;
      flex: 1;
      min-width: 0;
    }
    .label {
      font-size: var(--fs-xs);
      font-weight: 650;
      color: var(--text-3);
    }
    .value {
      color: var(--text-1);
      font-weight: 550;
      overflow-wrap: anywhere;
    }
  `,
})
export class ProfilePage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ProfileApi);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);

  protected readonly i = { Mail, Phone, KeyRound, UserRound };
  protected readonly genders = GENDERS;
  protected readonly profile = signal<UserProfile | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly detailsAction = useAction();

  protected readonly roles = computed(() =>
    (this.profile()?.roles ?? []).map((r) => ROLE_LABELS[r]).join(', '),
  );

  protected readonly details = new FormGroup({
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    gender: new FormControl<Gender>('Unspecified', { nonNullable: true }),
  });

  constructor() {
    void this.load();
    // Keep the details form in step with the loaded profile (only when it has no unsaved edits).
    effect(() => {
      const p = this.profile();
      if (p && this.details.pristine) {
        this.details.reset({ fullName: p.fullName, gender: p.gender });
      }
    });
  }

  protected async load(): Promise<void> {
    this.loadError.set(null);
    try {
      this.profile.set(await this.api.get());
    } catch (e) {
      this.loadError.set(errorMessage(e, 'Could not load your profile.'));
    }
  }

  protected since(iso: string): string {
    return formatDate(iso);
  }

  async saveDetails(): Promise<void> {
    this.details.markAllAsTouched();
    if (this.details.invalid) return;
    const v = this.details.getRawValue();
    const user = await this.detailsAction.run(
      () => this.api.update({ fullName: v.fullName.trim(), gender: v.gender }),
      { form: this.details, success: 'Profile updated.' },
    );
    if (user) {
      this.details.markAsPristine();
      this.profile.set(user);
    }
  }

  protected async changeEmail(): Promise<void> {
    const user = await this.openDialog(ChangeEmailDialog, this.profile());
    if (user) this.toast.success(`Use ${user.email} to sign in from now on.`, 'Email changed');
  }

  protected async changePhone(): Promise<void> {
    const data: ChangePhoneData = {
      profile: this.profile()!,
      isCitizen: this.auth.hasRole('Citizen'),
    };
    const user = await this.openDialog(ChangePhoneDialog, data);
    if (user) this.toast.success(`Your phone is now ${user.maskedPhone ?? 'saved'}.`);
  }

  protected async changePassword(): Promise<void> {
    const user = await this.openDialog(ChangePasswordDialog);
    if (user) {
      this.toast.success("You've been signed out on your other devices.", 'Password changed');
    }
  }

  private async openDialog<C, D>(
    component: ComponentType<C>,
    data?: D,
  ): Promise<UserProfile | undefined> {
    const ref = this.modal.open<UserProfile, D, C>(component, data, undefined, 'narrow');
    const user = await firstValueFrom(ref.closed);
    // A password change returns the AuthResponse user, which may omit maskedPhone: keep ours.
    if (user) this.profile.update((p) => ({ ...p, ...user }));
    return user;
  }
}
