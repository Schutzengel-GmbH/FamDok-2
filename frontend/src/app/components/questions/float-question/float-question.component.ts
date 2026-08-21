import {
  Component,
  effect,
  Input,
  linkedSignal,
  model,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AnswerModel as Answer,
  QuestionModel as Question,
} from '../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-float-question',
  templateUrl: './float-question.component.html',
  styleUrls: ['./float-question.component.scss'],
  standalone: true,
  imports: [FormsModule],
})
export class FloatQuestionComponent implements OnInit {
  @Input({ required: true }) question!: Question;

  answer = model<Partial<Answer>>();
  value = linkedSignal<string>(
    () => this.answer()?.answerNum?.toLocaleString() || '',
  );

  answerValid = model<boolean>();
  reason = '';

  validate(value: string) {
    const question = this.question;

    if (!question.required && !value) {
      this.reason = '';
      this.answerValid.set(true);
      return;
    }

    if (question?.required && !value) {
      this.reason = 'Antwort ist nicht optional';
      this.answerValid.set(false);
      return;
    }

    if (!/^-?[0-9]*[.,]?[0-9]*$/.test(value)) {
      this.reason = 'Muss eine Dezimalzahl sein';
      this.answerValid.set(false);
      return;
    }

    const answer = parseFloat(value.replace(',', '.'));

    if (isNaN(answer)) {
      this.reason = 'Muss eine Zahl sein';
      this.answerValid.set(false);
      return;
    }

    if (question?.max && answer >= question.max) {
      this.reason = `Muss kleiner oder gleich ${question.max.toString().replace('.', ',')} sein`;
      this.answerValid.set(false);
      return;
    }

    if (question?.min && answer <= question.min) {
      this.reason = `Muss größer oder gleich ${question.min.toString().replace('.', ',')} sein`;
      this.answerValid.set(false);
      return;
    }

    this.reason = '';
    this.answerValid.set(true);
  }

  constructor() {}

  ngOnInit() {
    this.validate(this.value());
  }

  onInput(e: Event) {
    const inputEl = e.target as HTMLInputElement;
    const value = inputEl.value;

    let answer = parseFloat(value.replace(',', '.'));

    if (!isNaN(answer))
      this.answer.update((a) => ({
        ...a,
        questionId: this.question.id,
        answerNum: answer,
      }));

    this.validate(value);
  }
}
