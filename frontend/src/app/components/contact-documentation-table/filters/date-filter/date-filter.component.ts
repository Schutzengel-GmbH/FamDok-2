import {
  Component,
  inject,
  input,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { DateFieldFilter } from 'src/app/util/filterUtils';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { DateFilter } from 'src/app/components/filter-inputs/date-filter/date-filter.component';

@Component({
  selector: 'app-date-filter-btn',
  standalone: true,
  templateUrl: './date-filter.component.html',
  styles: `
    .btn-no-outline {
      border: none;
    }
  `,
  imports: [FormsModule, DateFilter],
})
export class DateFilterContact {
  name = input.required<string>();
  filterChanged = output<DateFieldFilter | undefined>();

  private modalService = inject(NgbModal);
  filterInput: DateFieldFilter | undefined = undefined;
  active = signal(false);

  apply() {
    this.active.set(true);
    this.filterChanged.emit(this.filterInput);
  }

  cancel() {
    this.active.set(false);
    this.filterInput = undefined;
    this.filterChanged.emit(this.filterInput);
  }

  open(modal: TemplateRef<any>) {
    this.modalService
      .open(modal, { backdrop: 'static', keyboard: false })
      .result.then((result) => {
        if (result === 'apply') this.apply();
        else this.cancel();
      });
  }
}
