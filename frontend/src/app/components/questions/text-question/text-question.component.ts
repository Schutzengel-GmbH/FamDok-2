import { Component, Input, model, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AnswerModel as Answer,
  QuestionModel as Question,
} from '../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-text-question',
  templateUrl: './text-question.component.html',
  styleUrls: ['./text-question.component.scss'],
  standalone: true,
  imports: [FormsModule],
})
export class TextQuestionComponent implements OnInit {
  @Input({ required: true }) question!: Question;

  answer = model<Partial<Answer>>();

  answerValid = model<boolean>(true);
  reason = '';

  validate(value?: string | null) {
    if (this.question?.required && !value) {
      this.reason = 'Antwort ist nicht optional';
      return false;
    }

    this.reason = '';
    return true;
  }

  constructor() {}

  ngOnInit() {
    this.answerValid.update(() => this.validate(this.answer()?.answerText));
  }

  onChange(e: Event) {
    const value = (e.target as HTMLInputElement).value as string;

    this.answer.update((a) => ({
      ...a,
      questionId: this.question.id,
      answerText: value,
    }));
    this.answerValid.set(this.validate(value));
  }
}
