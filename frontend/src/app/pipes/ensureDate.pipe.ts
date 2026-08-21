import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'ensureDate',
  standalone: true,
})
export class EnsureDate implements PipeTransform {
  transform(value: string | Date | undefined) {
    if (!value) return undefined;
    return new Date(value);
  }
}
