import { Component, input, linkedSignal, output } from '@angular/core';

@Component({
  selector: 'app-inline-text',
  templateUrl: './edit-text.component.html',
  standalone: true,
})
export class EditText {
  value = input.required<string | undefined>();
  save = output<string>();
  nochange = output<void>();

  protected _value = linkedSignal(() => this.value());

  change(e: Event) {
    this._value.set((e.target as HTMLInputElement).value);
  }

  apply() {
    this.save.emit(this._value() || '');
  }

  cancel() {
    this._value.set(this.value());
    this.nochange.emit();
  }
}
