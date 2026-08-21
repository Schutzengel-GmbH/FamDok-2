import {
  Component,
  effect,
  inject,
  Input,
  linkedSignal,
  model,
  OnInit,
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
  selector: 'app-select-multiple',
  standalone: true,
  imports: [NgSelectComponent, FormsModule, NgLabelTemplateDirective],
  templateUrl: './select-multiple.html',
  styleUrl: './select-multiple.css',
})
export class SelectMultipleComponent {
  @Input({ required: true }) question!: Question;

  answer = model<Partial<Answer>>();

  model = linkedSignal(() =>
    this.answer()?.answerSelectId?.map((id) =>
      this.question.selectOptions.find((o) => o.id === id),
    ),
  );

  private modalService = inject(NgbModal);

  isAnswerValid = linkedSignal(() => {
    if (!this.answer()) return !this.question?.required;
    if (
      this.question?.required &&
      (!this.model() || this.model()!.length < 1)
    ) {
      return false;
    }
    return true;
  });

  constructor() {
    effect(() => this.isAnswerValid());
  }

  onChange(value: PrismaJson.SelectOption[]) {
    this.answer.update((a) => ({
      ...a,
      questionId: this.question.id,
      answerSelectId: value.map((o) => o.id),
    }));
  }

  onAdd(value: PrismaJson.SelectOption) {
    if (value.isOpen) this.onHandleOpenOption(value);
  }

  onHandleOpenOption(option: PrismaJson.SelectOption) {
    const modalRef = this.modalService.open(SelectOtherModalComponent);
    modalRef.componentInstance.selectOption = option;
    modalRef.componentInstance.answer = this.answer();
    modalRef.closed.subscribe(
      (result: { reason: 'save' | 'cancel'; value: string }) => {
        const { reason, value } = result;
        if (reason === 'save')
          this.answer.update((a) => ({ ...a, answerText: value }));
        else return;
      },
    );
  }

  compareFn(v1: PrismaJson.SelectOption, v2: PrismaJson.SelectOption) {
    return v1.id === v2.id;
  }
}
