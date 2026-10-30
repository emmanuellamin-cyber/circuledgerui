import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ChevronLeft, ChevronRight, LucideAngularModule } from 'lucide-angular';

/** Prev / next pager for `Paged<T>` envelopes (§4). */
@Component({
  selector: 'glass-paginator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <nav class="pager" aria-label="Pagination">
      <p class="info num">
        @if (total() > 0) {
          {{ from() }}–{{ to() }} of {{ total() }}
        } @else {
          0 results
        }
      </p>
      <div class="btns">
        <button
          type="button"
          class="pg"
          [disabled]="page() <= 1"
          (click)="pageChange.emit(page() - 1)"
          aria-label="Previous page"
        >
          <lucide-icon [img]="icons.ChevronLeft" [size]="18" />
        </button>
        <span class="num cur" aria-current="page">Page {{ page() }} / {{ pages() || 1 }}</span>
        <button
          type="button"
          class="pg"
          [disabled]="page() >= pages()"
          (click)="pageChange.emit(page() + 1)"
          aria-label="Next page"
        >
          <lucide-icon [img]="icons.ChevronRight" [size]="18" />
        </button>
      </div>
    </nav>
  `,
  styles: `
    .pager {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--s-2);
      padding-top: var(--s-3);
    }
    .info,
    .cur {
      font-size: var(--fs-sm);
      color: var(--text-2);
    }
    .btns {
      display: flex;
      align-items: center;
      gap: var(--s-2);
    }
    .pg {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 50%;
      background: var(--neutral-bg);
      color: var(--text-1);
      cursor: pointer;
    }
    .pg:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `,
})
export class Paginator {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pages = input.required<number>();
  readonly pageChange = output<number>();
  protected readonly icons = { ChevronLeft, ChevronRight };
  protected readonly from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  protected readonly to = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
}
