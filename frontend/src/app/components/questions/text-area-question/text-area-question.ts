import { Component, Input, model, OnInit } from '@angular/core';
import {
  AnswerModel as Answer,
  QuestionModel as Question,
} from '../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-text-area-question',
  standalone: true,
  imports: [],
  templateUrl: './text-area-question.html',
  styleUrl: './text-area-question.css',
})
export class TextAreaQuestionComponent implements OnInit {
  @Input({ required: true }) question!: Question;

  answer = model<Partial<Answer>>();

  answerValid = model<boolean>(true);
  reason = '';

  validate(value?: string | null) {
    if (this.question?.required && !value) {
      this.reason = 'Antwort ist nicht optional';
      this.answerValid.set(false);
      return;
    }

    this.reason = '';
    this.answerValid.set(true);
  }

  constructor() {}

  ngOnInit() {
    this.validate(this.answer()?.answerText);
  }

  onChange(e: Event) {
    const value = (e.target as HTMLInputElement).value as string;

    this.answer.update((a) => ({
      ...a,
      questionId: this.question.id,
      answerText: value,
    }));
    this.validate(value);
  }
}
