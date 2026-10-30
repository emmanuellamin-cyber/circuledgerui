import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';

let nextId = 0;

/** iOS-style switch backed by a native checkbox (role="switch"). */
@Component({
  selector: 'glass-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="wrap" [for]="id">
      <input
        [id]="id"
        type="checkbox"
        role="switch"
        [checked]="value()"
        [disabled]="isDisabled()"
        [attr.aria-describedby]="hint() ? id + '-hint' : null"
        (change)="toggle($event)"
        (blur)="onTouched()"
      />
      <span class="track" aria-hidden="true"><span class="thumb"></span></span>
      <span class="text">
        <span class="label">{{ label() }}</span>
        @if (hint()) {
          <span class="hint" [id]="id + '-hint'">{{ hint() }}</span>
        }
      </span>
    </label>
  `,
  styles: `
    .wrap {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      min-height: var(--touch);
      cursor: pointer;
    }
    input {
      position: absolute;
      opacity: 0;
      width: 1px;
      height: 1px;
    }
    .track {
      position: relative;
      flex: none;
      width: 48px;
      height: 28px;
      border-radius: 999px;
      background: var(--neutral-bg);
      box-shadow: inset 0 0 0 1px var(--field-border);
      transition: background var(--dur-2);
    }
    .thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 2px 6px rgb(0 0 0 / 0.25);
      transition: transform var(--dur-3) var(--ease-spring);
    }
    input:checked + .track {
      background: var(--accent);
    }
    input:checked + .track .thumb {
      transform: translateX(20px);
    }
    input:focus-visible + .track {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }
    input:disabled ~ * {
      opacity: 0.55;
    }
    .text {
      display: grid;
    }
    .label {
      font-size: var(--fs-sm);
      font-weight: 600;
    }
    .hint {
      font-size: var(--fs-xs);
      color: var(--text-3);
    }
    @media (prefers-reduced-motion: reduce) {
      .thumb {
        transition: none;
      }
    }
  `,
})
export class GlassSwitch implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly hint = input<string>();
  protected readonly id = `sw-${++nextId}`;
  protected readonly value = signal(false);
  protected readonly isDisabled = signal(false);
  private onChange: (v: boolean) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  constructor() {
    const ngControl = inject(NgControl, { self: true, optional: true });
    if (ngControl) ngControl.valueAccessor = this;
  }

  writeValue(v: unknown): void {
    this.value.set(v === true);
  }
  registerOnChange(fn: (v: boolean) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.isDisabled.set(d);
  }
  protected toggle(e: Event): void {
    const v = (e.target as HTMLInputElement).checked;
    this.value.set(v);
    this.onChange(v);
  }
}
