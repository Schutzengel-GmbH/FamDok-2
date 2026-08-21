import { Component, Input, linkedSignal, model, OnInit } from '@angular/core';
import {
  AnswerModel as Answer,
  QuestionModel as Question,
} from '../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-integer-question',
  templateUrl: './integer-question.component.html',
  styleUrls: ['./integer-question.component.scss'],
  standalone: true,
})
export class IntegerQuestionComponent implements OnInit {
  @Input({ required: true }) question!: Question;

  answer = model<Partial<Answer>>();
  value = linkedSignal<string>(
    () => this.answer()?.answerInt?.toString() || '',
  );

  answerValid = model<boolean>(true);
  reason = '';

  validate(value: string) {
    const question = this.question;

    if (!question.required && !value) return true;

    const answer = value === '' ? undefined : parseInt(value);

    if (question?.required && answer === undefined) {
      this.reason = 'Antwort ist nicht optional';
      return false;
    } else if (answer === undefined) {
      this.reason = '';
      return true;
    }

    if (!/^-?[0-9]*$/.test(value)) {
      this.reason = 'Muss eine ganze Zahl sein';
      return false;
    }

    if (answer > Number.MAX_SAFE_INTEGER) {
      this.reason =
        'Die Zahl ist größer als der maximal zulässige Integer-Wert';
      return false;
    }

    if (typeof answer !== 'number') {
      this.reason = 'Muss eine ganze Zahl sein';
      return false;
    }

    if (isNaN(answer)) {
      this.reason = 'Muss eine ganze Zahl sein';
      return false;
    }

    if (
      question?.max !== undefined &&
      question?.max !== null &&
      answer >= question.max
    ) {
      this.reason = `Muss kleiner oder gleich ${question.max} sein`;
      return false;
    }

    if (
      question?.min !== undefined &&
      question?.min !== null &&
      answer <= question.min
    ) {
      this.reason = `Muss größer oder gleich ${question.min} sein`;
      return false;
    }

    this.reason = '';
    return true;
  }

  constructor() {}

  ngOnInit() {
    this.answerValid.update(() => this.validate(this.value()));
  }

  onInput(e: Event) {
    const inputEl = e.target as HTMLInputElement;
    const value = inputEl.value;

    let answer = parseInt(value);

    if (!isNaN(answer))
      this.answer.update((a) => ({
        ...a,
        questionId: this.question.id,
        answerInt: answer,
      }));

    this.answerValid.update(() => this.validate(value));
  }
}
