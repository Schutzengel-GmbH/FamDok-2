import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-simple-text-filter',
  templateUrl: './simple-text-filter.component.html',
  standalone: true,
  imports: [FormsModule],
})
export class SimpleTextFilter {
  filter = model<string>();
  name = input.required<string>();

  resetFilter() {
    this.filter.set('');
  }

  changeValue(e: Event) {
    const filter = (e.target as HTMLInputElement).value;
    this.filter.set(filter);
  }
}
