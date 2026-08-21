import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { SimpleSelectFilter } from 'src/app/components/filter-inputs/simple-select-filter/simple-select-filter.component';
import { QuestionModel as Question } from '../../../../../../../shared/generated/prisma/models';
import { AnswerWhereInput } from '../../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-select-question-filter',
  standalone: true,
  templateUrl: './select-question-filter.component.html',
  styleUrl: '../../all-data.component.scss',
  imports: [FormsModule, SimpleSelectFilter],
})
export class SelectQuestionFilter {
  question = input.required<Question>();
  filterChanged = output<AnswerWhereInput>();

  options = computed(() => this.question().selectOptions);

  private modalService = inject(NgbModal);
  filterInput: PrismaJson.SelectOption | undefined = undefined;
  active = signal(false);

  apply() {
    this.active.set(true);
    if (!this.filterInput) this.filterChanged.emit({});
    else
      this.filterChanged.emit({
        questionId: this.question().id,
        answerSelectId: { has: this.filterInput.id },
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
