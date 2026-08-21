import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { makeTextQuestionFilter } from 'src/app/util/filterUtils';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { SimpleTextFilter } from 'src/app/components/filter-inputs/simple-text-filter/simple-text-filter.component';
import { QuestionModel as Question } from '../../../../../../../shared/generated/prisma/models';
import { AnswerWhereInput } from '../../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-text-question-filter',
  standalone: true,
  templateUrl: './text-question-filter.component.html',
  styleUrl: '../../all-data.component.scss',
  imports: [FormsModule, SimpleTextFilter],
})
export class TextQuestionFilter {
  question = input.required<Question>();
  filterChanged = output<AnswerWhereInput>();

  options = computed(() => {
    const options =
      this.question().selectOptions?.map((o) => ({
        label: o.text,
        value: o.id,
      })) ?? [];
    return options;
  });

  private modalService = inject(NgbModal);
  filterInput: string | undefined = undefined;
  active = signal(false);

  apply() {
    this.active.set(true);
    this.filterChanged.emit(
      makeTextQuestionFilter({
        question: this.question(),
        value: this.filterInput,
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
