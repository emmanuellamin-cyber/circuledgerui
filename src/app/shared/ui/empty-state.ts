import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Inbox, LucideAngularModule, LucideIconData } from 'lucide-angular';

/** "Nothing here yet" with a helpful next step projected as content. */
@Component({
  selector: 'empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="badge glass glass--subtle" aria-hidden="true">
      <lucide-icon [img]="icon()" [size]="28" />
    </div>
    <h3>{{ heading() }}</h3>
    @if (message()) {
      <p class="muted">{{ message() }}</p>
    }
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: grid;
      justify-items: center;
      gap: var(--s-2);
      padding: var(--s-6) var(--s-4);
      text-align: center;
    }
    .badge {
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      margin-bottom: var(--s-2);
      border-radius: 22px;
      color: var(--accent-ink);
    }
    p {
      max-width: 42ch;
      font-size: var(--fs-sm);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--s-2);
      justify-content: center;
      margin-top: var(--s-3);
    }
    .actions:empty {
      display: none;
    }
  `,
})
export class EmptyState {
  readonly heading = input.required<string>();
  readonly message = input<string>();
  readonly icon = input<LucideIconData>(Inbox);
}
