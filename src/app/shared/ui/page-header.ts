import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Consistent page title + subtitle with a primary-action slot `[page-actions]`. */
@Component({
  selector: 'page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="titles">
      <h1>{{ heading() }}</h1>
      @if (subheading()) {
        <p class="muted">{{ subheading() }}</p>
      }
    </div>
    <div class="actions"><ng-content select="[page-actions]" /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--s-3);
      margin-bottom: var(--s-4);
    }
    .titles {
      display: grid;
      gap: 4px;
      min-width: 0;
    }
    h1 {
      font-size: var(--fs-2xl);
    }
    p {
      font-size: var(--fs-sm);
      max-width: 70ch;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--s-2);
    }
    .actions:empty {
      display: none;
    }
  `,
})
export class PageHeader {
  readonly heading = input.required<string>();
  readonly subheading = input<string>();
}
