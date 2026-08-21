import { Component, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NgbDateAdapter,
  NgbDateNativeAdapter,
  NgbDateParserFormatter,
  NgbDatepicker,
} from '@ng-bootstrap/ng-bootstrap';
import { NgbDateDeParserFormatter } from 'src/app/util/NgbDatePickerFormatter';

@Component({
  selector: 'app-inline-date',
  templateUrl: './edit-date.component.html',
  standalone: true,
  imports: [NgbDatepicker, FormsModule],
  providers: [
    { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter },
    { provide: NgbDateParserFormatter, useClass: NgbDateDeParserFormatter },
  ],
})
export class EditDate {
  value = input.required<Date | undefined>();
  save = output<Date>();
  nochange = output<void>();

  protected _value = linkedSignal(() => this.value());

  change(e: Date) {
    this._value.set(e);
  }

  apply() {
    if (!this._value()) return;
    this.save.emit(this._value()!);
  }

  cancel() {
    this._value.set(this.value());
    this.nochange.emit();
  }
}
