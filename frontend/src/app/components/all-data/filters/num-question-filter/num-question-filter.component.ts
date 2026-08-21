import {
  Component,
  inject,
  input,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import {
  makeNumberQuestionFilter,
  NumFieldFilter,
} from 'src/app/util/filterUtils';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { NumberFilterInput } from 'src/app/components/filter-inputs/number-filter/number-filter.component';
import { QuestionModel as Question } from '../../../../../../../shared/generated/prisma/models';
import { AnswerWhereInput } from '../../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-num-question-filter',
  standalone: true,
  templateUrl: './num-question-filter.component.html',
  styleUrl: '../../all-data.component.scss',
  imports: [FormsModule, NumberFilterInput],
})
export class NumQuestionFilter {
  question = input.required<Question>();
  filterChanged = output<AnswerWhereInput>();

  private modalService = inject(NgbModal);
  filterInput: NumFieldFilter | undefined = undefined;
  active = signal(false);

  apply() {
    this.active.set(true);
    if (!this.filterInput) this.filterChanged.emit({});
    else
      this.filterChanged.emit(
        makeNumberQuestionFilter({
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
