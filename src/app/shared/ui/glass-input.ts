import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import { LucideAngularModule, LucideIconData, Eye, EyeOff } from 'lucide-angular';
import { firstErrorMessage } from './field-errors';

let nextId = 0;

/**
 * Labelled text field for reactive forms. Reads its own control so validation and server
 * (ProblemDetails) errors show automatically after the field is touched.
 */
@Component({
  selector: 'glass-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <label class="label" [for]="id">
      {{ label() }}
      @if (optional()) {
        <span class="opt">optional</span>
      }
    </label>
    <div class="field" [class.invalid]="error()" [class.disabled]="isDisabled()">
      @if (icon(); as ic) {
        <lucide-icon class="lead" [img]="ic" [size]="18" aria-hidden="true" />
      }
      @if (rows() > 0) {
        <textarea
          [id]="id"
          [rows]="rows()"
          [value]="value()"
          [attr.placeholder]="placeholder() || null"
          [attr.maxlength]="maxlength() ?? null"
          [attr.aria-invalid]="error() ? true : null"
          [attr.aria-describedby]="describedBy()"
          [attr.aria-required]="required() || null"
          [disabled]="isDisabled()"
          (input)="onInput($event)"
          (blur)="onBlur()"
        ></textarea>
      } @else {
        <input
          [id]="id"
          [type]="reveal() ? 'text' : type()"
          [value]="value()"
          [attr.placeholder]="placeholder() || null"
          [attr.autocomplete]="autocomplete() || null"
          [attr.inputmode]="inputmode() || null"
          [attr.maxlength]="maxlength() ?? null"
          [attr.list]="suggestions().length ? id + '-list' : null"
          [attr.aria-invalid]="error() ? true : null"
          [attr.aria-describedby]="describedBy()"
          [attr.aria-required]="required() || null"
          [disabled]="isDisabled()"
          [spellcheck]="spellcheck()"
          (input)="onInput($event)"
          (blur)="onBlur()"
          [attr.step]="step() ?? null"
          [attr.min]="min() ?? null"
          [attr.max]="max() ?? null"
        />
      }
      @if (type() === 'password') {
        <button
          type="button"
          class="reveal"
          [attr.aria-label]="reveal() ? 'Hide password' : 'Show password'"
          [attr.aria-pressed]="reveal()"
          (click)="reveal.set(!reveal())"
        >
          <lucide-icon [img]="reveal() ? icons.EyeOff : icons.Eye" [size]="18" />
        </button>
      }
    </div>
    @if (suggestions().length) {
      <datalist [id]="id + '-list'">
        @for (s of suggestions(); track s) {
          <option [value]="s"></option>
        }
      </datalist>
    }
    @if (error(); as message) {
      <p class="msg error" [id]="id + '-error'" role="alert">{{ message }}</p>
    } @else if (hint()) {
      <p class="msg" [id]="id + '-hint'">{{ hint() }}</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .label {
      font-size: var(--fs-sm);
      font-weight: 600;
      color: var(--text-1);
    }
    .opt {
      font-weight: 400;
      color: var(--text-3);
      margin-left: 4px;
    }
    .field {
      display: flex;
      align-items: center;
      gap: var(--s-2);
      min-height: 48px;
      padding: 0 var(--s-4);
      border-radius: var(--r-md);
      background: var(--field-bg);
      box-shadow:
        inset 0 0 0 1px var(--field-border),
        inset 0 1px 2px rgb(4 32 27 / 0.06);
      transition:
        box-shadow var(--dur-2) var(--ease-out),
        background var(--dur-2);
    }
    .field:hover {
      box-shadow: inset 0 0 0 1px var(--field-border-hover);
    }
    .field:focus-within {
      box-shadow:
        inset 0 0 0 2px var(--focus),
        0 0 0 4px var(--accent-soft);
    }
    .field.invalid {
      box-shadow: inset 0 0 0 2px var(--danger);
    }
    .field.disabled {
      opacity: 0.6;
    }
    input {
      flex: 1;
      min-width: 0;
      height: 46px;
      border: 0;
      background: transparent;
      outline: none;
      font-size: var(--fs-base);
      color: var(--text-1);
    }
    textarea {
      flex: 1;
      min-width: 0;
      padding: 12px 0;
      border: 0;
      background: transparent;
      outline: none;
      resize: vertical;
      font-size: var(--fs-base);
      color: var(--text-1);
    }
    .field:has(textarea) {
      align-items: flex-start;
    }
    input::placeholder {
      color: var(--text-3);
      opacity: 1;
    }
    .lead {
      color: var(--text-3);
    }
    .reveal {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      margin-right: -8px;
      border: 0;
      border-radius: var(--r-pill);
      background: transparent;
      color: var(--text-2);
      cursor: pointer;
    }
    .reveal:hover {
      background: var(--neutral-bg);
    }
    .msg {
      font-size: var(--fs-xs);
      color: var(--text-3);
    }
    .msg.error {
      color: var(--danger);
      font-weight: 550;
    }
  `,
})
export class GlassInput implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly type = input<
    'text' | 'email' | 'password' | 'tel' | 'number' | 'search' | 'url' | 'date' | 'datetime-local'
  >('text');
  /** > 0 renders a textarea with this many rows. */
  readonly rows = input(0);
  readonly step = input<string | number>();
  readonly min = input<string | number>();
  readonly max = input<string | number>();
  readonly placeholder = input<string>();
  readonly hint = input<string>();
  readonly autocomplete = input<string>();
  readonly inputmode = input<string>();
  readonly maxlength = input<number>();
  readonly icon = input<LucideIconData>();
  readonly optional = input(false);
  readonly required = input(false);
  readonly spellcheck = input(false);
  readonly suggestions = input<readonly string[]>([]);
  /** Overrides the computed error message. */
  readonly errorText = input<string | null>(null);
  /** Extra validator-key → message mappings (e.g. `{ pattern: 'Use 15 digits' }`). */
  readonly messages = input<Record<string, string>>({});

  protected readonly icons = { Eye, EyeOff };
  protected readonly id = `gi-${++nextId}`;
  protected readonly value = signal('');
  protected readonly isDisabled = signal(false);
  protected readonly reveal = signal(false);
  /** Bumped on blur / status change so `error` recomputes. */
  private readonly tick = signal(0);

  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly error = computed<string | null>(() => {
    this.tick();
    if (this.errorText()) return this.errorText();
    const c = this.ngControl?.control;
    if (!c || !(c.touched || c.dirty) || c.valid) return null;
    return firstErrorMessage(c.errors, this.label(), this.messages());
  });

  protected readonly describedBy = computed(() =>
    this.error() ? `${this.id}-error` : this.hint() ? `${this.id}-hint` : null,
  );

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const sub = this.ngControl?.control?.events.subscribe(() => this.tick.update((n) => n + 1));
      destroyRef.onDestroy(() => sub?.unsubscribe());
    });
  }

  writeValue(v: unknown): void {
    this.value.set(v === null || v === undefined ? '' : String(v));
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.isDisabled.set(disabled);
  }

  protected onInput(e: Event): void {
    const v = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.value.set(v);
    this.onChange(v);
  }
  protected onBlur(): void {
    this.onTouched();
    this.tick.update((n) => n + 1);
  }
}
