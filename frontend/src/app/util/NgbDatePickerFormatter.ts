import { Injectable } from '@angular/core';
import {
  NgbDateParserFormatter,
  NgbDateStruct,
} from '@ng-bootstrap/ng-bootstrap';

@Injectable()
export class NgbDateDeParserFormatter extends NgbDateParserFormatter {
  override parse(value: string): NgbDateStruct | null {
    const parts = value.split('.');
    if (parts.length !== 3) return null;
    const dateStruct = {
      year: parseInt(parts[2]),
      month: parseInt(parts[1]),
      day: parseInt(parts[0]),
    };

    if (
      Number.isNaN(dateStruct.day) ||
      Number.isNaN(dateStruct.month) ||
      Number.isNaN(dateStruct.year)
    )
      throw new Error('error parsing date');

    return dateStruct;
  }
  override format(date: NgbDateStruct | null): string {
    if (!date) return '';
    const { year, month, day } = date;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(day)}.${pad(month)}.${year}`;
  }
}
