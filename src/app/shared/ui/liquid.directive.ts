import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/**
 * Pointer-following specular highlight. Writes `--mx` / `--my` on the host, throttled to one
 * update per animation frame, with listeners added outside Angular's change detection so
 * moving the mouse never re-renders anything. Pair with the `.liquid` class.
 */
@Directive({
  selector: '[liquid]',
  host: { class: 'liquid' },
})
export class LiquidDirective {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      let frame = 0;
      let x = 0;
      let y = 0;
      const onMove = (e: PointerEvent): void => {
        if (e.pointerType !== 'mouse') return;
        x = e.clientX;
        y = e.clientY;
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          const rect = el.getBoundingClientRect();
          el.style.setProperty('--mx', `${x - rect.left}px`);
          el.style.setProperty('--my', `${y - rect.top}px`);
        });
      };
      el.addEventListener('pointermove', onMove, { passive: true });
      destroyRef.onDestroy(() => {
        el.removeEventListener('pointermove', onMove);
        cancelAnimationFrame(frame);
      });
    });
  }
}
