import { Pipe, PipeTransform } from '@angular/core';
import { Familienstand } from '../../../../shared/generated/prisma/enums';
import { FAMILIENSTAND_LABELS } from '../../../../shared/utils/labels';

@Pipe({
  name: 'familienstand',
  standalone: true,
})
export class FamilienstandPipe implements PipeTransform {
  transform(f: Familienstand) {
    return FAMILIENSTAND_LABELS[f];
  }
}
