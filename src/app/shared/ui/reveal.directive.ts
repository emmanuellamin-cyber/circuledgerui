import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  input,
  numberAttribute,
} from '@angular/core';

/** Fades the element in the first time it scrolls into view. `[reveal]="index"` staggers. */
@Directive({
  selector: '[reveal]',
  host: { class: 'reveal', '[style.--i]': 'reveal()' },
})
export class RevealDirective {
  readonly reveal = input(0, { transform: (v: unknown) => numberAttribute(v, 0) });

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (!('IntersectionObserver' in window)) {
        el.classList.add('in-view');
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            el.classList.add('in-view');
            io.disconnect();
          }
        },
        { rootMargin: '0px 0px -10% 0px' },
      );
      io.observe(el);
      destroyRef.onDestroy(() => io.disconnect());
    });
  }
}
