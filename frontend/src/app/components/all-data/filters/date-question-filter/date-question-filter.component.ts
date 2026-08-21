import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import {
  DateFieldFilter,
  makeDateQuestionFilter,
} from 'src/app/util/filterUtils';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { DateFilter } from 'src/app/components/filter-inputs/date-filter/date-filter.component';
import { QuestionModel as Question } from '../../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-date-question-filter',

  standalone: true,
  templateUrl: './date-question-filter.component.html',
  styleUrl: '../../all-data.component.scss',
  imports: [FormsModule, DateFilter],
})
export class DateQuestionFilter {
  question = input.required<Question>();
  filterChanged = output<any>();

  options = computed(() => {
    const options =
      this.question().selectOptions?.map((o) => ({
        label: o.text,
        value: o.id,
      })) ?? [];
    return options;
  });

  private modalService = inject(NgbModal);
  filterInput: DateFieldFilter | undefined = undefined;
  active = signal(false);

  apply() {
    this.active.set(true);
    if (!this.filterInput) this.filterChanged.emit({});
    else
      this.filterChanged.emit(
        makeDateQuestionFilter({
          question: this.question(),
          filter: this.filterInput,
        }),
      );
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
