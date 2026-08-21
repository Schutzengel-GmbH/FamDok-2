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
    return {
      year: parseInt(parts[2]),
      month: parseInt(parts[1]),
      day: parseInt(parts[0]),
    };
  }
  override format(date: NgbDateStruct | null): string {
    if (!date) return '';
    const { year, month, day } = date;
    return `${day}.${month}.${year}`;
  }
}
