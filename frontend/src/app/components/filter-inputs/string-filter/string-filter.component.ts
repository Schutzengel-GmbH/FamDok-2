import { Component, input, linkedSignal, model, OnInit } from '@angular/core';
import { StringFieldFilter } from 'src/app/util/filterUtils';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-string-filter',
  templateUrl: './string-filter.component.html',
  standalone: true,
  imports: [FormsModule],
})
export class StringFilter {
  filter = model<StringFieldFilter>();
  name = input.required<string>();

  resetFilter() {
    this.filter.set(undefined);
  }

  changeFilter(e: Event) {
    const filter = (e.target as HTMLInputElement)
      .value as StringFieldFilter['filter'];
    this.filter.update((f) => ({ filter, value: f?.value || '' }));
  }

  changeValue(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    this.filter.update((f) => ({
      filter: f?.filter || 'equals',
      value: value,
    }));
  }
}
