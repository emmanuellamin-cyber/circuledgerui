import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { LucideAngularModule, Plus, ShieldCheck, Users } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { UsersApi } from '../../../core/api/admin.api';
import type { Gender, Role, UserProfile } from '../../../core/api/types';
import { AuthService } from '../../../core/auth/auth.service';
import { ROLE_LABELS } from '../../../core/auth/roles';
import { GENDERS, ROLES, options } from '../../../core/enums/labels';
import { formatDate } from '../../../core/format/format';
import { useAction } from '../../../core/state/action';
import { opt, urlQuery } from '../../../core/state/url-query';
import {
  CheckboxGroup,
  EmptyState,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassModal,
  GlassSelect,
  ModalService,
  PageHeader,
  Paginator,
  Skeleton,
  StatusPill,
  ToastService,
} from '../../../shared/ui';
import { strongPassword } from '../../auth/register';
import { withAll } from '../shared/ops-dialogs';

const roleOptions = options(ROLES, ROLE_LABELS);
const atLeastOne = (c: { value: string[] }) =>
  c.value.length ? null : { server: 'Choose at least one role.' };

/** POST /users (Admin): creates a staff account. */
@Component({
  selector: 'create-user-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, CheckboxGroup, GlassButton],
  template: `
    <glass-modal
      heading="New staff account"
      description="Share the temporary password privately; ask them to change it."
      (closed)="ref.close()"
    >
      <form id="cu-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-input
          class="full"
          label="Full name"
          formControlName="fullName"
          [maxlength]="150"
          [required]="true"
        />
        <glass-input label="Email" type="email" formControlName="email" [required]="true" />
        <glass-select label="Gender" formControlName="gender" [options]="genders" />
        <glass-input
          class="full"
          label="Temporary password"
          type="password"
          formControlName="password"
          autocomplete="new-password"
          hint="At least 10 characters with upper-case, lower-case and a digit."
        />
        <div class="full">
          <checkbox-group label="Roles" formControlName="roles" [options]="roles" />
        </div>
        @if (action.error(); as e) {
          <p class="form-error full" role="alert">{{ e }}</p>
        }
      </form>
      <ng-container modal-footer>
        <button glass-button variant="ghost" type="button" (click)="ref.close()">Cancel</button>
        <button
          glass-button
          variant="primary"
          type="submit"
          form="cu-form"
          [loading]="action.busy()"
        >
          Create account
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class CreateUserDialog {
  protected readonly ref = inject<DialogRef<UserProfile>>(DialogRef);
  private readonly api = inject(UsersApi);
  protected readonly action = useAction();
  protected readonly genders = options(GENDERS, { Unspecified: 'Prefer not to say' });
  protected readonly roles = roleOptions;
  protected readonly form = new FormGroup({
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    gender: new FormControl<Gender>('Unspecified', { nonNullable: true }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, strongPassword],
    }),
    roles: new FormControl<string[]>(['FieldAgent'], {
      nonNullable: true,
      validators: [atLeastOne],
    }),
  });
  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      if (this.form.controls.roles.invalid) this.action.error.set('Choose at least one role.');
      return;
    }
    const v = this.form.getRawValue();
    const res = await this.action.run(
      this.api.create({
        fullName: v.fullName.trim(),
        email: v.email.trim(),
        gender: v.gender,
        password: v.password,
        roles: v.roles as Role[],
      }),
      { form: this.form, success: 'Account created.' },
    );
    if (res) this.ref.close(res);
  }
}

/** PUT /users/{id}/roles. Takes effect at the user's next login or token refresh. */
@Component({
  selector: 'roles-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, CheckboxGroup, GlassButton],
  template: `
    <glass-modal
      heading="Edit roles"
      [description]="data.fullName + ' · ' + data.email"
      (closed)="ref.close()"
    >
      <form id="ro-form" (ngSubmit)="submit()" class="stack">
        <checkbox-group label="Roles" [formControl]="roles" [options]="options" />
        <p class="banner info">Changes apply when they next log in or their session refreshes.</p>
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
          form="ro-form"
          [loading]="action.busy()"
        >
          Save roles
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class RolesDialog {
  protected readonly data = inject<UserProfile>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<UserProfile>>(DialogRef);
  private readonly api = inject(UsersApi);
  protected readonly action = useAction();
  protected readonly options = roleOptions;
  protected readonly roles = new FormControl<string[]>([...this.data.roles], { nonNullable: true });
  async submit(): Promise<void> {
    if (!this.roles.value.length) {
      this.action.error.set('Choose at least one role.');
      return;
    }
    const res = await this.action.run(this.api.setRoles(this.data.id, this.roles.value as Role[]), {
      success: 'Roles updated.',
    });
    if (res) this.ref.close(res);
  }
}

/** Users (Admin, §8.2). */
@Component({
  selector: 'ops-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    GlassInput,
    GlassSelect,
    StatusPill,
    Paginator,
    Skeleton,
    EmptyState,
  ],
  template: `
    <page-header
      heading="Users"
      subheading="Staff accounts and their roles. Buyers and citizens register themselves."
    >
      <button page-actions glass-button variant="primary" type="button" (click)="create()">
        <lucide-icon [img]="i.Plus" [size]="16" aria-hidden="true" /> New staff account
      </button>
    </page-header>
    <form
      class="filter-bar glass"
      role="search"
      aria-label="Filter users"
      (submit)="$event.preventDefault()"
    >
      <glass-input
        label="Search"
        placeholder="Name or email"
        [formControl]="search"
        autocomplete="off"
      />
      <glass-select label="Role" [options]="roleFilter" [formControl]="role" />
    </form>
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
              Users
            </caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Roles</th>
                <th scope="col">Joined</th>
                <th scope="col">Status</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (u of list.value()!.items; track u.id) {
                <tr>
                  <td data-label="Name">
                    {{ u.fullName }}
                    <div class="subtle tiny">{{ u.email }}</div>
                  </td>
                  <td data-label="Roles">{{ roleNames(u) }}</td>
                  <td data-label="Joined">{{ date(u.createdAt) }}</td>
                  <td data-label="Status">
                    <status-pill
                      [status]="u.isActive ? 'Active' : 'Inactive'"
                      [tone]="u.isActive ? 'success' : 'neutral'"
                    />
                  </td>
                  <td class="r">
                    <div class="row end">
                      <button glass-button size="sm" type="button" (click)="editRoles(u)">
                        <lucide-icon [img]="i.ShieldCheck" [size]="13" aria-hidden="true" /> Roles
                      </button>
                      @if (u.id !== me()) {
                        <button
                          glass-button
                          size="sm"
                          type="button"
                          [variant]="u.isActive ? 'ghost' : 'secondary'"
                          (click)="toggleActive(u)"
                        >
                          {{ u.isActive ? 'Deactivate' : 'Reactivate' }}
                        </button>
                      }
                    </div>
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
            heading="No users match"
            message="Try another name or role."
            [icon]="i.Users"
          />
        }
      </div>
    </glass-card>
  `,
  styles: `
    .tiny {
      font-size: var(--fs-xs);
    }
    .end {
      justify-content: flex-end;
      --row-gap: var(--s-2);
    }
  `,
})
export class OpsUsers {
  private readonly api = inject(UsersApi);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  protected readonly i = { Plus, ShieldCheck, Users };
  protected readonly roleFilter = withAll(roleOptions, 'Any role');
  protected readonly me = computed(() => this.auth.user()?.id);

  protected readonly q = urlQuery({ role: '', search: '' });
  protected readonly search = new FormControl(this.q.value().search, { nonNullable: true });
  protected readonly role = new FormControl(this.q.value().role, { nonNullable: true });
  protected readonly list = rxResource({
    params: () => ({ ...this.q.value(), page: this.q.page() }),
    stream: ({ params: p }) =>
      this.api.list({
        role: opt<Role>(p.role),
        search: p.search.trim() || undefined,
        page: p.page,
        pageSize: 20,
      }),
  });
  protected readonly errorText = computed(() => errorMessage(this.list.error()));

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((search) => this.q.set({ search }));
    this.role.valueChanges.pipe(takeUntilDestroyed()).subscribe((role) => this.q.set({ role }));
  }

  protected create(): void {
    this.modal.open<UserProfile>(CreateUserDialog).closed.subscribe((u) => u && this.list.reload());
  }
  protected editRoles(u: UserProfile): void {
    this.modal.open<UserProfile>(RolesDialog, u).closed.subscribe((r) => r && this.list.reload());
  }
  protected async toggleActive(u: UserProfile): Promise<void> {
    if (u.isActive) {
      const ok = await this.modal.confirm({
        title: `Deactivate ${u.fullName}?`,
        message: "They won't be able to log in or refresh their session until reactivated.",
        confirmLabel: 'Deactivate',
        danger: true,
      });
      if (!ok) return;
    }
    this.api.setActive(u.id, !u.isActive).subscribe({
      next: () => {
        this.toast.success(u.isActive ? 'Account deactivated.' : 'Account reactivated.');
        this.list.reload();
      },
      error: (e: unknown) => this.toast.error(e),
    });
  }
  protected roleNames(u: UserProfile): string {
    return u.roles.map((r) => ROLE_LABELS[r]).join(', ') || '—';
  }
  protected date(v: string): string {
    return formatDate(v);
  }
}
