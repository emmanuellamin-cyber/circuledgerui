import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import type { SelectOption } from './glass-select';

/** Multi-select as a fieldset of checkbox chips. Value: string[]. */
@Component({
  selector: 'checkbox-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset>
      <legend>{{ label() }}</legend>
      <div class="opts">
        @for (o of options(); track o.value) {
          <label class="opt" [class.on]="value().includes(o.value)">
            <input
              type="checkbox"
              [checked]="value().includes(o.value)"
              [disabled]="isDisabled()"
              (change)="toggle(o.value, $event)"
              (blur)="onTouched()"
            />
            {{ o.label }}
          </label>
        }
        @if (!options().length) {
          <span class="empty">{{ emptyText() }}</span>
        }
      </div>
      @if (hint()) {
        <p class="hint">{{ hint() }}</p>
      }
    </fieldset>
  `,
  styles: `
    fieldset {
      border: 0;
      margin: 0;
      padding: 0;
      min-width: 0;
      display: grid;
      gap: 6px;
    }
    legend {
      padding: 0;
      margin-bottom: 6px;
      font-size: var(--fs-sm);
      font-weight: 600;
    }
    .opts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .opt {
      position: relative;
      display: inline-flex;
      align-items: center;
      min-height: 40px;
      padding: 0 14px;
      border-radius: 999px;
      background: var(--field-bg);
      box-shadow: inset 0 0 0 1px var(--field-border);
      font-size: var(--fs-sm);
      font-weight: 600;
      cursor: pointer;
    }
    .opt.on {
      background: var(--accent-soft);
      box-shadow: inset 0 0 0 2px var(--accent);
      color: var(--accent-ink);
    }
    .opt input {
      position: absolute;
      inset: 0;
      opacity: 0;
      margin: 0;
      cursor: pointer;
    }
    .opt:has(input:focus-visible) {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    .empty,
    .hint {
      font-size: var(--fs-xs);
      color: var(--text-3);
    }
  `,
})
export class CheckboxGroup implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly hint = input<string>();
  readonly emptyText = input('Nothing to choose from.');
  protected readonly value = signal<readonly string[]>([]);
  protected readonly isDisabled = signal(false);
  private onChange: (v: string[]) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  constructor() {
    const ngControl = inject(NgControl, { self: true, optional: true });
    if (ngControl) ngControl.valueAccessor = this;
  }

  writeValue(v: unknown): void {
    this.value.set(Array.isArray(v) ? (v as string[]) : []);
  }
  registerOnChange(fn: (v: string[]) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.isDisabled.set(d);
  }
  protected toggle(v: string, e: Event): void {
    const on = (e.target as HTMLInputElement).checked;
    const next = on ? [...this.value(), v] : this.value().filter((x) => x !== v);
    this.value.set(next);
    this.onChange(next);
  }
}
