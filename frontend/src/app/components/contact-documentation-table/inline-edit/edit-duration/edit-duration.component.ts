import { Component, input, linkedSignal, output } from '@angular/core';

@Component({
  selector: 'app-inline-duration',
  templateUrl: './edit-duration.component.html',
  standalone: true,
})
export class EditDuration {
  value = input.required<number | undefined>();
  save = output<number>();
  nochange = output<void>();

  protected _value = linkedSignal(() => this.value());

  change(e: Event) {
    this._value.set(Number((e.target as HTMLInputElement).value));
  }

  apply() {
    this.save.emit(Number(this._value()));
  }

  cancel() {
    this._value.set(this.value());
    this.nochange.emit();
  }
}
