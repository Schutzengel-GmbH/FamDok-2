import {
  Component,
  inject,
  input,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { CaseFilterInput, makeCaseFilter } from 'src/app/util/filterUtils';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { StringFilter } from '../../../filter-inputs/string-filter/string-filter.component';
import { DateFilter } from '../../../filter-inputs/date-filter/date-filter.component';
import { Topics } from '../../../../../../../shared/definitions/zielvereinbarung';
import { isEmptyObject } from 'src/app/util/generalUtils';
import { CaseWhereInput } from '../../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-case-filter',
  standalone: true,
  templateUrl: './case-filter.component.html',
  styleUrl: '../../all-data.component.scss',
  imports: [FormsModule, StringFilter, DateFilter],
})
export class CaseFilter {
  filterChanged = output<CaseWhereInput>();
  anon = input<boolean>();

  private modalService = inject(NgbModal);

  filterInput: CaseFilterInput = {};
  active = signal(false);

  topics = Topics.map((t) => ({ label: t, value: t }));
  status = [
    { label: 'In Arbeit', value: 'inProgress' },
    { label: 'Abgeschlossen', value: 'done' },
    { label: 'Fehlgeschlagen', value: 'failed' },
  ];

  apply() {
    this.active.set(!isEmptyObject(this.filterInput));
    this.filterChanged.emit(makeCaseFilter(this.filterInput));
  }

  cancel() {
    this.active.set(false);
    this.filterInput = {};
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
