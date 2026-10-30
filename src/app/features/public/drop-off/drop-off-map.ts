import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { DropOffPoint } from '../../../core/api/types';
import { DROP_OFF_TYPE_LABELS } from '../../../core/enums/labels';
import { GlassMap, MapPin } from '../../../shared/ui/glass-map';

/** Active drop-off points on the shared OpenStreetMap component. */
@Component({
  selector: 'drop-off-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GlassMap],
  template: `<glass-map [pins]="pins()" ariaLabel="Map of drop-off points" />`,
})
export class DropOffMap {
  readonly points = input.required<readonly DropOffPoint[]>();
  protected readonly pins = computed<MapPin[]>(() =>
    this.points().map((p) => ({
      lat: p.latitude,
      lng: p.longitude,
      title: p.name,
      lines: [DROP_OFF_TYPE_LABELS[p.type], ...(p.landmark ? [p.landmark] : []), p.openingHours],
    })),
  );
}
