import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, of } from 'rxjs';
import {
  Briefcase,
  GraduationCap,
  HardHat,
  LucideAngularModule,
  Pencil,
  Plus,
} from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { PeopleApi, UsersApi } from '../../../core/api/admin.api';
import type {
  EmploymentRecord,
  EmploymentType,
  EnrollmentStatus,
  Gender,
  TraineeEnrollment,
  TrainingCycle,
} from '../../../core/api/types';
import {
  EMPLOYMENT_TYPES,
  ENROLLMENT_STATUSES,
  GENDERS,
  humanize,
  options,
} from '../../../core/enums/labels';
import { formatDate } from '../../../core/format/format';
import { useAction } from '../../../core/state/action';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassModal,
  GlassSelect,
  GlassSwitch,
  GlassTab,
  GlassTabs,
  ModalService,
  PageHeader,
  SelectOption,
  Skeleton,
  StatusPill,
} from '../../../shared/ui';
import { withAll } from '../shared/ops-dialogs';

const genderOptions = options(GENDERS, { Unspecified: 'Prefer not to say' });

/** Technicians and agents to link (GET /users is Admin-only; others just skip linking). */
function useStaffOptions(role: 'Technician' | 'FieldAgent' | undefined) {
  const users = inject(UsersApi);
  const res = rxResource({
    stream: () => users.list({ role, pageSize: 100 }).pipe(catchError(() => of(null))),
  });
  return computed<SelectOption[] | null>(() => {
    const v = res.value();
    if (v === null) return null;
    return withAll(
      (v?.items ?? []).map((u) => ({ value: u.id, label: `${u.fullName} · ${u.email}` })),
      'Not linked to an account',
    );
  });
}

@Component({
  selector: 'cycle-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassButton],
  template: `
    <glass-modal heading="New training cycle" (closed)="ref.close()">
      <form id="cy-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-input
          class="full"
          label="Name"
          formControlName="name"
          [maxlength]="120"
          placeholder="Cohort 2: Repair & battery safety"
          [required]="true"
        />
        <glass-input
          class="full"
          label="Focus"
          formControlName="focus"
          [optional]="true"
          placeholder="Repair, data wiping, Li-ion safety"
        />
        <glass-input
          class="full"
          label="Location"
          formControlName="location"
          [optional]="true"
          placeholder="Bo Campus"
        />
        <glass-input label="Start date" type="date" formControlName="startDate" [required]="true" />
        <glass-input label="End date" type="date" formControlName="endDate" [optional]="true" />
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
          form="cy-form"
          [loading]="action.busy()"
        >
          Create cycle
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class CycleDialog {
  protected readonly ref = inject<DialogRef<TrainingCycle>>(DialogRef);
  private readonly api = inject(PeopleApi);
  protected readonly action = useAction();
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    focus: new FormControl('', { nonNullable: true }),
    location: new FormControl('', { nonNullable: true }),
    startDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    endDate: new FormControl('', { nonNullable: true }),
  });
  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (v.endDate && v.startDate && v.endDate < v.startDate)
      this.form.controls.endDate.setErrors({
        server: 'End date must be on or after the start date.',
      });
    if (this.form.invalid) return;
    const res = await this.action.run(
      this.api.createCycle({
        name: v.name.trim(),
        focus: v.focus.trim() || null,
        location: v.location.trim() || null,
        startDate: v.startDate,
        endDate: v.endDate || null,
      }),
      { form: this.form, success: 'Training cycle created.' },
    );
    if (res) this.ref.close(res);
  }
}

@Component({
  selector: 'enroll-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassButton],
  template: `
    <glass-modal heading="Enroll a trainee" [description]="cycle.name" (closed)="ref.close()">
      <form id="en-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-input
          class="full"
          label="Full name"
          formControlName="fullName"
          [maxlength]="150"
          [required]="true"
        />
        <glass-select
          label="Gender"
          formControlName="gender"
          [options]="genders"
          hint="Used for the ≥ 40% women KPI."
        />
        @if (staff(); as opts) {
          <glass-select
            label="Linked account"
            formControlName="userId"
            [options]="opts"
            hint="Link a Technician so safety training unlocks dismantling."
          />
        } @else {
          <p class="subtle small">Linking to a staff account needs the Admin user list.</p>
        }
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
          form="en-form"
          [loading]="action.busy()"
        >
          Enroll
        </button>
      </ng-container>
    </glass-modal>
  `,
  styles: `
    .small {
      font-size: var(--fs-xs);
      align-self: end;
    }
  `,
})
export class EnrollDialog {
  protected readonly cycle = inject<TrainingCycle>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<TraineeEnrollment>>(DialogRef);
  private readonly api = inject(PeopleApi);
  protected readonly action = useAction();
  protected readonly genders = genderOptions;
  protected readonly staff = useStaffOptions('Technician');
  protected readonly form = new FormGroup({
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    gender: new FormControl<Gender>('Unspecified', { nonNullable: true }),
    userId: new FormControl('', { nonNullable: true }),
  });
  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const res = await this.action.run(
      this.api.enroll(this.cycle.id, {
        fullName: v.fullName.trim(),
        gender: v.gender,
        userId: v.userId || null,
      }),
      {
        form: this.form,
        success: 'Trainee enrolled.',
      },
    );
    if (res) this.ref.close(res);
  }
}

@Component({
  selector: 'progress-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassSelect, GlassSwitch, GlassButton],
  template: `
    <glass-modal heading="Update progress" [description]="data.fullName" (closed)="ref.close()">
      <form id="pr-form" [formGroup]="form" (ngSubmit)="submit()" class="stack">
        <glass-select label="Status" formControlName="status" [options]="statuses" />
        <glass-switch
          label="Safety training completed"
          formControlName="safetyTrainingCompleted"
          hint="Required for dismantling and handling hazardous materials."
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
          form="pr-form"
          [loading]="action.busy()"
        >
          Save
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class ProgressDialog {
  protected readonly data = inject<TraineeEnrollment>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<TraineeEnrollment>>(DialogRef);
  private readonly api = inject(PeopleApi);
  protected readonly action = useAction();
  protected readonly statuses = options(ENROLLMENT_STATUSES);
  protected readonly form = new FormGroup({
    status: new FormControl<EnrollmentStatus>(this.data.status, { nonNullable: true }),
    safetyTrainingCompleted: new FormControl(this.data.safetyTrainingCompleted, {
      nonNullable: true,
    }),
  });
  async submit(): Promise<void> {
    const res = await this.action.run(
      this.api.updateEnrollment(this.data.id, this.form.getRawValue()),
      { form: this.form, success: 'Progress saved.' },
    );
    if (res) this.ref.close(res);
  }
}

@Component({
  selector: 'employment-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassButton],
  template: `
    <glass-modal
      heading="Record a job"
      description="Counts towards the jobs-created KPI."
      (closed)="ref.close()"
    >
      <form id="em-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-input
          class="full"
          label="Full name"
          formControlName="fullName"
          [maxlength]="150"
          [required]="true"
        />
        <glass-select label="Gender" formControlName="gender" [options]="genders" />
        <glass-input
          label="Job title"
          formControlName="jobTitle"
          placeholder="Refurbishment Technician"
          [required]="true"
        />
        <glass-select label="Type" formControlName="employmentType" [options]="types" />
        <glass-input label="Start date" type="date" formControlName="startDate" [required]="true" />
        <glass-input label="End date" type="date" formControlName="endDate" [optional]="true" />
        @if (staff(); as opts) {
          <glass-select label="Linked account" formControlName="userId" [options]="opts" />
        }
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
          form="em-form"
          [loading]="action.busy()"
        >
          Save
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class EmploymentDialog {
  protected readonly ref = inject<DialogRef<EmploymentRecord>>(DialogRef);
  private readonly api = inject(PeopleApi);
  protected readonly action = useAction();
  protected readonly genders = genderOptions;
  protected readonly types = options(EMPLOYMENT_TYPES);
  protected readonly staff = useStaffOptions(undefined);
  protected readonly form = new FormGroup({
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    gender: new FormControl<Gender>('Unspecified', { nonNullable: true }),
    jobTitle: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    employmentType: new FormControl<EmploymentType>('PartTime', { nonNullable: true }),
    startDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    endDate: new FormControl('', { nonNullable: true }),
    userId: new FormControl('', { nonNullable: true }),
  });
  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const res = await this.action.run(
      this.api.createEmployment({
        fullName: v.fullName.trim(),
        gender: v.gender,
        jobTitle: v.jobTitle.trim(),
        employmentType: v.employmentType,
        startDate: v.startDate,
        endDate: v.endDate || null,
        userId: v.userId || null,
      }),
      { form: this.form, success: 'Job recorded.' },
    );
    if (res) this.ref.close(res);
  }
}

type Tab = 'training' | 'jobs';

/** Training & jobs (§8.16). */
@Component({
  selector: 'ops-training',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    GlassTabs,
    StatusPill,
    Skeleton,
    EmptyState,
  ],
  template: `
    <page-header
      heading="Training & jobs"
      subheading="Youth repair cohorts, safety certification and the jobs they lead to."
    >
      <ng-container page-actions>
        @if (tab() === 'training') {
          <button glass-button variant="primary" type="button" (click)="newCycle()">
            <lucide-icon [img]="i.Plus" [size]="16" aria-hidden="true" /> New cycle
          </button>
        } @else {
          <button glass-button variant="primary" type="button" (click)="newJob()">
            <lucide-icon [img]="i.Plus" [size]="16" aria-hidden="true" /> Record job
          </button>
        }
      </ng-container>
    </page-header>
    <glass-tabs [tabs]="tabs" [(selected)]="tab" ariaLabel="Training or jobs" />

    @if (tab() === 'training') {
      <div class="split block">
        <div class="cycles" [attr.aria-busy]="cycles.isLoading()">
          @if (cycles.isLoading() && !cycles.value()) {
            <skeleton [lines]="4" height="60px" />
          } @else if (cycles.error()) {
            <p class="form-error">{{ err(cycles.error()) }}</p>
          } @else if (cycles.value()?.length) {
            @for (c of cycles.value(); track c.id) {
              <button
                type="button"
                class="cycle glass"
                [class.on]="selected()?.id === c.id"
                (click)="selected.set(c)"
                [attr.aria-pressed]="selected()?.id === c.id"
              >
                <strong>{{ c.name }}</strong>
                <span class="subtle tiny"
                  >{{ date(c.startDate) }} – {{ c.endDate ? date(c.endDate) : 'ongoing'
                  }}{{ c.location ? ' · ' + c.location : '' }}</span
                >
                <span class="counts num"
                  >{{ c.enrolledCount }} enrolled · {{ c.completedCount }} completed ·
                  {{ c.safetyCertifiedCount }} safety-certified</span
                >
              </button>
            }
          } @else {
            <empty-state
              heading="No training cycles"
              message="Create the first cohort to start tracking trainees."
              [icon]="i.GraduationCap"
            />
          }
        </div>

        <glass-card
          [heading]="selected()?.name ?? 'Enrollments'"
          [subheading]="selected() ? 'Trainees in this cycle' : 'Choose a cycle'"
        >
          @if (selected(); as c) {
            <button card-actions glass-button size="sm" type="button" (click)="enroll(c)">
              <lucide-icon [img]="i.Plus" [size]="14" aria-hidden="true" /> Enroll
            </button>
          }
          @if (selected()) {
            @if (enrollments.value()?.length) {
              <table class="data">
                <caption class="sr-only">
                  Enrollments
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Trainee</th>
                    <th scope="col">Status</th>
                    <th scope="col">Safety</th>
                    <th scope="col"><span class="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of enrollments.value(); track e.id) {
                    <tr>
                      <td data-label="Trainee">
                        {{ e.fullName }}
                        <div class="subtle tiny">
                          {{ humanize(e.gender) }}{{ e.userId ? ' · linked account' : '' }}
                        </div>
                      </td>
                      <td data-label="Status"><status-pill [status]="e.status" /></td>
                      <td data-label="Safety">
                        @if (e.safetyTrainingCompleted) {
                          <span class="safe"
                            ><lucide-icon [img]="i.HardHat" [size]="14" aria-hidden="true" />
                            Certified</span
                          >
                        } @else {
                          <span class="subtle">Not yet</span>
                        }
                      </td>
                      <td class="r">
                        <button glass-button size="sm" type="button" (click)="progress(e)">
                          <lucide-icon [img]="i.Pencil" [size]="13" aria-hidden="true" /> Update
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else if (enrollments.isLoading()) {
              <skeleton [lines]="4" />
            } @else {
              <p class="muted small">No trainees yet.</p>
            }
          }
        </glass-card>
      </div>
    } @else {
      <glass-card padding="sm" class="block">
        @if (jobs.value()?.length) {
          <table class="data">
            <caption class="sr-only">
              Jobs created
            </caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Job</th>
                <th scope="col">Type</th>
                <th scope="col">Start</th>
                <th scope="col">End</th>
              </tr>
            </thead>
            <tbody>
              @for (j of jobs.value(); track j.id) {
                <tr>
                  <td data-label="Name">
                    {{ j.fullName }}
                    <div class="subtle tiny">{{ humanize(j.gender) }}</div>
                  </td>
                  <td data-label="Job">{{ j.jobTitle }}</td>
                  <td data-label="Type">{{ humanize(j.employmentType) }}</td>
                  <td data-label="Start">{{ date(j.startDate) }}</td>
                  <td data-label="End">{{ j.endDate ? date(j.endDate) : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else if (jobs.isLoading()) {
          <skeleton [lines]="5" />
        } @else {
          <empty-state
            heading="No jobs recorded"
            message="Record full-time, part-time, stipend or apprenticeship roles created by the Hub."
            [icon]="i.Briefcase"
          />
        }
      </glass-card>
    }
  `,
  styles: `
    .block {
      margin-top: var(--s-4);
    }
    .cycles {
      display: grid;
      gap: var(--s-2);
      align-content: start;
    }
    .cycle {
      display: grid;
      gap: 4px;
      padding: var(--s-4);
      border: 0;
      border-radius: var(--r-lg);
      text-align: left;
      color: var(--text-1);
      font: inherit;
      cursor: pointer;
    }
    .cycle.on {
      box-shadow:
        inset 0 0 0 2px var(--accent),
        var(--glass-shadow);
    }
    .counts {
      font-size: var(--fs-sm);
      color: var(--text-2);
    }
    .tiny {
      font-size: var(--fs-xs);
    }
    .small {
      font-size: var(--fs-sm);
    }
    .safe {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--success);
      font-weight: 600;
    }
  `,
})
export class OpsTraining {
  private readonly api = inject(PeopleApi);
  private readonly modal = inject(ModalService);
  protected readonly i = { Plus, GraduationCap, Briefcase, HardHat, Pencil };
  protected readonly humanize = humanize;
  protected readonly tabs: GlassTab<Tab>[] = [
    { id: 'training', label: 'Training', icon: GraduationCap },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
  ];
  protected readonly tab = signal<Tab>('training');
  protected readonly cycles = rxResource({ stream: () => this.api.cycles() });
  protected readonly jobs = rxResource({ stream: () => this.api.employment() });
  protected readonly selected = signal<TrainingCycle | null>(null);
  protected readonly enrollments = rxResource({
    params: () => this.selected()?.id,
    stream: ({ params: id }) => this.api.enrollments(id),
  });

  protected newCycle(): void {
    this.modal.open<TrainingCycle>(CycleDialog).closed.subscribe((c) => {
      if (!c) return;
      this.cycles.reload();
      this.selected.set(c);
    });
  }
  protected enroll(c: TrainingCycle): void {
    this.modal
      .open<TraineeEnrollment>(EnrollDialog, c)
      .closed.subscribe((e) => e && this.refreshEnrollments());
  }
  protected progress(e: TraineeEnrollment): void {
    this.modal
      .open<TraineeEnrollment>(ProgressDialog, e)
      .closed.subscribe((r) => r && this.refreshEnrollments());
  }
  protected newJob(): void {
    this.modal
      .open<EmploymentRecord>(EmploymentDialog)
      .closed.subscribe((j) => j && this.jobs.reload());
  }
  protected date(v: string): string {
    return formatDate(v);
  }
  protected err(e: unknown): string {
    return errorMessage(e);
  }
  private refreshEnrollments(): void {
    this.enrollments.reload();
    this.cycles.reload();
  }
}
