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
import { ChevronDown, LucideAngularModule } from 'lucide-angular';
import { firstErrorMessage } from './field-errors';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

let nextId = 0;

/** Native `<select>` (best on phones and screen readers) dressed as glass. */
@Component({
  selector: 'glass-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <label class="label" [for]="id">{{ label() }}</label>
    <div class="field" [class.invalid]="error()">
      <select
        [id]="id"
        [disabled]="isDisabled()"
        [attr.aria-invalid]="error() ? true : null"
        [attr.aria-describedby]="error() ? id + '-error' : hint() ? id + '-hint' : null"
        (change)="onSelect($event)"
        (blur)="onBlur()"
      >
        @if (placeholder()) {
          <option value="" [selected]="value() === ''" disabled>{{ placeholder() }}</option>
        }
        @for (o of options(); track o.value) {
          <option [value]="o.value" [selected]="o.value === value()">{{ o.label }}</option>
        }
      </select>
      <lucide-icon class="chev" [img]="ChevronDown" [size]="18" aria-hidden="true" />
    </div>
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
    }
    .field {
      position: relative;
      border-radius: var(--r-md);
      background: var(--field-bg);
      box-shadow: inset 0 0 0 1px var(--field-border);
      transition: box-shadow var(--dur-2) var(--ease-out);
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
    select {
      appearance: none;
      width: 100%;
      height: 48px;
      padding: 0 40px 0 var(--s-4);
      border: 0;
      border-radius: inherit;
      background: transparent;
      outline: none;
      font-size: var(--fs-base);
      color: var(--text-1);
      cursor: pointer;
    }
    option {
      color: #04201b;
      background: #fff;
    }
    .chev {
      position: absolute;
      right: 12px;
      top: 15px;
      color: var(--text-3);
      pointer-events: none;
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
export class GlassSelect implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly placeholder = input<string>();
  readonly hint = input<string>();

  protected readonly ChevronDown = ChevronDown;
  protected readonly id = `gs-${++nextId}`;
  protected readonly value = signal('');
  protected readonly isDisabled = signal(false);
  private readonly tick = signal(0);
  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly error = computed<string | null>(() => {
    this.tick();
    const c = this.ngControl?.control;
    if (!c || !c.touched || c.valid) return null;
    return firstErrorMessage(c.errors, this.label());
  });

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

  protected onSelect(e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    this.value.set(v);
    this.onChange(v);
  }
  protected onBlur(): void {
    this.onTouched();
    this.tick.update((n) => n + 1);
  }
}
