import { Injectable, signal } from '@angular/core';

/** Detail screens set a last crumb (e.g. a tracking ID) and clear it on destroy. */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  readonly detail = signal<string | null>(null);
}
