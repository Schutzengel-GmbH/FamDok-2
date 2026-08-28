import {
  Component,
  effect,
  inject,
  Input,
  linkedSignal,
  model,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  NgLabelTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { SelectOtherModalComponent } from '../select-other-modal/select-other-modal';
import {
  AnswerModel as Answer,
  QuestionModel as Question,
} from '../../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-select-one',
  standalone: true,
  imports: [NgSelectComponent, FormsModule, NgLabelTemplateDirective],
  templateUrl: './select-one.html',
  styleUrl: './select-one.css',
})
export class SelectOneComponent {
  @Input({ required: true }) question!: Question;

  answer = model<Partial<Answer>>();

  model = linkedSignal(() =>
    this.answer
      ? this.question.selectOptions.find(
          (o) => o.id === this.answer()?.answerSelectId?.at(0),
        )
      : undefined,
  );

  private modalService = inject(NgbModal);

  isAnswerValid = linkedSignal(() => {
    if (!this.model()) return !this.question?.required;
    if (this.question?.required && !this.model()) {
      return false;
    }

    return true;
  });

  onChange(option: PrismaJson.SelectOption) {
    if (!option) {
      this.answer.update((a) => ({
        ...a,
        questionId: this.question.id,
        answerSelectId: [],
      }));
    } else {
      this.answer.update((a) => ({
        ...a,
        questionId: this.question.id,
        answerSelectId: [option.id],
      }));
      if (option.isOpen) this.onHandleOpenOption(option);
    }
  }

  onHandleOpenOption(option: PrismaJson.SelectOption) {
    const modalRef = this.modalService.open(SelectOtherModalComponent);
    modalRef.componentInstance.selectOption = option;
    modalRef.componentInstance.answer = this.answer();
    modalRef.closed.subscribe(
      (result: { reason: 'save' | 'cancel'; value: string }) => {
        const { reason, value } = result;
        if (reason === 'save')
          this.answer.update((a) => ({
            ...a,
            answerSelectId: [option.id],
            answerText: value,
          }));
        else return;
      },
    );
  }
}
