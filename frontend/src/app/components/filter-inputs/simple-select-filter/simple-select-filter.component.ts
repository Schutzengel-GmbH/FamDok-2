import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-simple-select-filter',
  templateUrl: './simple-select-filter.component.html',
  standalone: true,
  imports: [FormsModule],
})
export class SimpleSelectFilter {
  filter = model<PrismaJson.SelectOption | undefined>();
  name = input.required<string>();
  options = input.required<PrismaJson.SelectOption[]>();

  resetFilter() {
    this.filter.set(undefined);
  }
}
