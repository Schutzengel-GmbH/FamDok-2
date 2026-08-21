import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate',
  standalone: true,
})
export class TruncatePipe implements PipeTransform {
  transform(value: string, maxLength?: number) {
    const length = maxLength || 3;
    if (value.length <= length) return value;
    else return value.substring(0, length) + '...';
  }
}
