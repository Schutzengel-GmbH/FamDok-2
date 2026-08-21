import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-simple-num-filter',
  templateUrl: './simple-num-filter.component.html',
  standalone: true,
  imports: [FormsModule],
})
export class SimpleNumberFilter {
  filter = model<number | undefined>();
  name = input.required<string>();

  resetFilter() {
    this.filter.set(undefined);
  }

  changeValue(e: Event) {
    const value = Number((e.target as HTMLInputElement).value);
    this.filter.set(value);
  }
}
