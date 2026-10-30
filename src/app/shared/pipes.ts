import { Pipe, PipeTransform } from '@angular/core';
import { formatSle, maskTail, relativeTime } from '../core/format/format';

/** `1200 | sle` → "SLE 1,200.00" */
@Pipe({ name: 'sle' })
export class SleCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatSle(value);
  }
}

/** Keeps the last N characters. API values that are already masked pass through unchanged. */
@Pipe({ name: 'masked' })
export class MaskedPipe implements PipeTransform {
  transform(value: string | null | undefined, visible = 4): string {
    return maskTail(value, visible);
  }
}

/** "3 hours ago". Pure: re-evaluates when the input changes, not on a timer. */
@Pipe({ name: 'relativeTime' })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return relativeTime(value);
  }
}
