import { Component, input, model, signal } from '@angular/core';
import { DateFieldFilter } from 'src/app/util/filterUtils';
import { FormsModule } from '@angular/forms';
import {
  NgbInputDatepicker,
  NgbDateAdapter,
  NgbDateNativeAdapter,
  NgbDateParserFormatter,
} from '@ng-bootstrap/ng-bootstrap';
import { NgbDateDeParserFormatter } from 'src/app/util/NgbDatePickerFormatter';

@Component({
  selector: 'app-date-filter',
  templateUrl: './date-filter.component.html',
  standalone: true,
  imports: [FormsModule, NgbInputDatepicker],
  providers: [
    { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter },
    { provide: NgbDateParserFormatter, useClass: NgbDateDeParserFormatter },
  ],
})
export class DateFilter {
  filter = model<DateFieldFilter>();
  name = input.required<string>();

  startDate = signal<Date | undefined>(
    Array.isArray(this.filter()?.value)
      ? (this.filter()!.value as Date[])[0]
      : undefined,
  );
  endDate = signal<Date | undefined>(
    Array.isArray(this.filter()?.value)
      ? (this.filter()!.value as Date[])[1]
      : undefined,
  );

  resetFilter() {
    this.filter.set(undefined);
  }

  changeFilter(e: Event) {
    const filter = (e.target as HTMLInputElement)
      .value as DateFieldFilter['filter'];
    this.filter.update((f) => ({ filter, value: f?.value || new Date() }));
  }

  changeValue(date: Date) {
    this.filter.update((f) => ({
      filter: f?.filter || 'equals',
      value: date,
    }));
  }

  changeStartValue(date: Date) {
    this.filter.update((f) => ({
      filter: f?.filter || 'equals',
      value: [date, (f?.value as Date[])?.[1] || undefined],
    }));
  }

  changeEndValue(date: Date) {
    this.filter.update((f) => ({
      filter: f?.filter || 'equals',
      value: [(f?.value as Date[])?.[0] || undefined, date],
    }));
  }
}
