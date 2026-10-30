import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, Megaphone, Plus } from 'lucide-angular';
import { errorMessage } from '../../../core/api/api-error';
import { PeopleApi } from '../../../core/api/admin.api';
import type { AwarenessCampaign, CampaignType, InstitutionType } from '../../../core/api/types';
import { CAMPAIGN_TYPES, INSTITUTION_TYPES, humanize, options } from '../../../core/enums/labels';
import { formatDate, formatNumber, isoDate } from '../../../core/format/format';
import { useAction } from '../../../core/state/action';
import {
  EmptyState,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassModal,
  GlassSelect,
  ModalService,
  PageHeader,
  Skeleton,
  StatTile,
} from '../../../shared/ui';

/**
 * POST /awareness-campaigns. KPIs count DISTINCT institution names, so the name field
 * autocompletes from earlier entries to keep spelling consistent (§8.16).
 */
@Component({
  selector: 'campaign-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, GlassModal, GlassInput, GlassSelect, GlassButton],
  template: `
    <glass-modal heading="Log an awareness activity" (closed)="ref.close()">
      <form id="aw-form" [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
        <glass-input
          class="full"
          label="Institution"
          formControlName="institutionName"
          [suggestions]="names"
          placeholder="Bo Government Secondary School"
          hint="Pick an existing name when it's the same place: schools are counted by name."
          [required]="true"
        />
        <glass-select
          label="Institution type"
          formControlName="institutionType"
          [options]="institutionTypes"
        />
        <glass-select label="Activity" formControlName="campaignType" [options]="campaignTypes" />
        <glass-input label="Date" type="date" formControlName="date" [required]="true" />
        <glass-input label="People reached" type="number" formControlName="reachCount" [min]="0" />
        <glass-input class="full" label="Location" formControlName="location" [optional]="true" />
        <glass-input
          class="full"
          label="Notes"
          formControlName="notes"
          [rows]="2"
          [optional]="true"
        />
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
          form="aw-form"
          [loading]="action.busy()"
        >
          Save
        </button>
      </ng-container>
    </glass-modal>
  `,
})
export class CampaignDialog {
  protected readonly names = inject<string[]>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<AwarenessCampaign>>(DialogRef);
  private readonly api = inject(PeopleApi);
  protected readonly action = useAction();
  protected readonly institutionTypes = options(INSTITUTION_TYPES);
  protected readonly campaignTypes = options(CAMPAIGN_TYPES, {
    CollectionDrive: 'Collection drive',
    SocialMedia: 'Social media',
  });
  protected readonly form = new FormGroup({
    institutionName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    institutionType: new FormControl<InstitutionType>('School', { nonNullable: true }),
    campaignType: new FormControl<CampaignType>('Talk', { nonNullable: true }),
    date: new FormControl(isoDate(), { nonNullable: true, validators: [Validators.required] }),
    reachCount: new FormControl('0', { nonNullable: true, validators: [Validators.min(0)] }),
    location: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    // Snap to an existing name that differs only by case/spacing.
    const typed = v.institutionName.trim().replace(/\s+/g, ' ');
    const name = this.names.find((n) => n.toLowerCase() === typed.toLowerCase()) ?? typed;
    const res = await this.action.run(
      this.api.createCampaign({
        institutionName: name,
        institutionType: v.institutionType,
        campaignType: v.campaignType,
        date: v.date,
        reachCount: Number(v.reachCount) || 0,
        location: v.location.trim() || null,
        notes: v.notes.trim() || null,
      }),
      { form: this.form, success: 'Activity logged.' },
    );
    if (res) this.ref.close(res);
  }
}

/** Awareness campaigns (§8.16). */
@Component({
  selector: 'ops-awareness',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    PageHeader,
    GlassCard,
    GlassButton,
    StatTile,
    Skeleton,
    EmptyState,
  ],
  template: `
    <page-header
      heading="Awareness"
      subheading="Talks, workshops, radio and collection drives in schools, campuses and communities."
    >
      <button page-actions glass-button variant="primary" type="button" (click)="add()">
        <lucide-icon [img]="i.Plus" [size]="16" aria-hidden="true" /> Log activity
      </button>
    </page-header>
    <div class="kpi-grid">
      <stat-tile
        label="Schools reached"
        [value]="distinct('School')"
        caption="distinct names · target 5"
      />
      <stat-tile
        label="Campuses reached"
        [value]="distinct('Campus')"
        caption="distinct names · target 2"
      />
      <stat-tile
        label="People reached"
        [value]="reach()"
        caption="all activities"
        [icon]="i.Megaphone"
      />
    </div>
    <glass-card padding="sm" class="block">
      @if (list.isLoading() && !list.value()) {
        <skeleton [lines]="6" height="22px" />
      } @else if (list.error()) {
        <div class="form-error" role="alert">
          {{ errorText() }}
          <button glass-button size="sm" type="button" (click)="list.reload()">Retry</button>
        </div>
      } @else if (sorted().length) {
        <table class="data">
          <caption class="sr-only">
            Awareness activities, newest first
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Institution</th>
              <th scope="col">Activity</th>
              <th scope="col" class="r">Reached</th>
              <th scope="col">Location</th>
            </tr>
          </thead>
          <tbody>
            @for (c of sorted(); track c.id) {
              <tr>
                <td data-label="Date">{{ date(c.date) }}</td>
                <td data-label="Institution">
                  {{ c.institutionName }}
                  <div class="subtle tiny">{{ c.institutionType }}</div>
                </td>
                <td data-label="Activity">
                  {{ humanize(c.campaignType) }}
                  @if (c.notes) {
                    <div class="subtle tiny">{{ c.notes }}</div>
                  }
                </td>
                <td data-label="Reached" class="r num">{{ num(c.reachCount) }}</td>
                <td data-label="Location">{{ c.location ?? '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <empty-state
          heading="No activities yet"
          message="Log school talks, radio shows and collection drives to track reach."
          [icon]="i.Megaphone"
        />
      }
    </glass-card>
  `,
  styles: `
    .block {
      margin-top: var(--s-4);
    }
    .tiny {
      font-size: var(--fs-xs);
    }
  `,
})
export class OpsAwareness {
  private readonly api = inject(PeopleApi);
  private readonly modal = inject(ModalService);
  protected readonly i = { Plus, Megaphone };
  protected readonly humanize = humanize;
  protected readonly list = rxResource({ stream: () => this.api.campaigns() });
  protected readonly errorText = computed(() => errorMessage(this.list.error()));
  protected readonly sorted = computed(() =>
    [...(this.list.value() ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
  );
  private readonly names = computed(() =>
    [...new Set((this.list.value() ?? []).map((c) => c.institutionName))].sort(),
  );
  protected readonly reach = computed(() =>
    formatNumber((this.list.value() ?? []).reduce((s, c) => s + c.reachCount, 0)),
  );

  protected distinct(type: InstitutionType): string {
    return String(
      new Set(
        (this.list.value() ?? [])
          .filter((c) => c.institutionType === type)
          .map((c) => c.institutionName),
      ).size,
    );
  }
  protected add(): void {
    this.modal
      .open<AwarenessCampaign>(CampaignDialog, this.names())
      .closed.subscribe((c) => c && this.list.reload());
  }
  protected date(v: string): string {
    return formatDate(v);
  }
  protected num(v: number): string {
    return formatNumber(v);
  }
}
