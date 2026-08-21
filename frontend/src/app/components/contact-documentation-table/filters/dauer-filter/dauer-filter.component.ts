import {
  Component,
  inject,
  input,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { NumFieldFilter } from 'src/app/util/filterUtils';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { NumberFilterInput } from 'src/app/components/filter-inputs/number-filter/number-filter.component';
import { ContactDocumentationWhereInput } from '../../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-dauer-filter',
  standalone: true,
  templateUrl: './dauer-filter.component.html',
  styles: `
    .btn-no-outline {
      border: none;
    }
  `,
  imports: [FormsModule, NumberFilterInput],
})
export class DauerFilter {
  name = input.required<string>();
  filterChanged = output<ContactDocumentationWhereInput['duration']>();

  private modalService = inject(NgbModal);
  filterInput: NumFieldFilter | undefined = undefined;
  active = signal(false);

  apply() {
    this.active.set(true);
    if (!this.filterInput) this.filterChanged.emit({});
    else if (this.filterInput.filter === 'range')
      this.filterChanged.emit({
        gte: (this.filterInput.value as number[]).at(0),
        lte: (this.filterInput.value as number[]).at(1),
      });
    else
      this.filterChanged.emit({
        [this.filterInput.filter]: this.filterInput.value as number,
      });
  }

  cancel() {
    this.active.set(false);
    this.filterInput = undefined;
    this.filterChanged.emit({});
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
