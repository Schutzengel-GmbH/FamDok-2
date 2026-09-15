import { Pipe, PipeTransform } from '@angular/core';
import { Familienstand } from '../../../../shared/generated/prisma/enums';

@Pipe({
  name: 'familienstand',
  standalone: true,
})
export class FamilienstandPipe implements PipeTransform {
  transform(f: Familienstand) {
    switch (f) {
      case 'ledig':
        return 'Ledig';
      case 'verheiratet':
        return 'Verheiratet';
      case 'geschieden':
        return 'Geschieden';
      case 'verwitwet':
        return 'Verwitwet';
      case 'unspecified':
        return 'Keine Angabe';
    }
  }
}
