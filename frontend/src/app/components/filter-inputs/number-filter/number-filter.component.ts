import { Component, input, model, signal } from '@angular/core';
import { NumFieldFilter } from 'src/app/util/filterUtils';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-number-filter-input',
  templateUrl: './number-filter.component.html',
  standalone: true,
  imports: [FormsModule],
})
export class NumberFilterInput {
  filter = model<NumFieldFilter>();
  name = input.required<string>();

  startValue = signal<number | undefined>(
    Array.isArray(this.filter()?.value)
      ? (this.filter()!.value as number[])[0]
      : undefined,
  );
  endValue = signal<number | undefined>(
    Array.isArray(this.filter()?.value)
      ? (this.filter()!.value as number[])[1]
      : undefined,
  );

  resetFilter() {
    this.filter.set(undefined);
  }

  changeFilter(e: Event) {
    const filter = (e.target as HTMLInputElement)
      .value as NumFieldFilter['filter'];
    this.filter.update((f) => ({ filter, value: f?.value || 0 }));
  }

  changeValue(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    this.endValue.set(value);
    this.filter.update((f) => ({
      filter: f?.filter || 'equals',
      value,
    }));
  }

  changeStartValue(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    this.startValue.set(value);
    this.filter.update((f) => ({
      filter: f?.filter || 'equals',
      value: [value, (f?.value as number[])?.[1] || 0],
    }));
  }

  changeEndValue(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    this.filter.update((f) => ({
      filter: f?.filter || 'equals',
      value: [(f?.value as number[])?.[0] || 0, value],
    }));
  }
}
