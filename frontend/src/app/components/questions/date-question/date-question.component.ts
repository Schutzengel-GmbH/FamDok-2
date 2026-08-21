import {
  Component,
  effect,
  Input,
  linkedSignal,
  model,
  OnInit,
} from '@angular/core';
import {
  NgbDateParserFormatter,
  NgbDatepickerModule,
  NgbDateStruct,
} from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { NgbDateDeParserFormatter } from 'src/app/util/NgbDatePickerFormatter';
import {
  AnswerModel as Answer,
  QuestionModel as Question,
} from '../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-date-question',
  templateUrl: './date-question.component.html',
  styleUrls: ['./date-question.component.scss'],
  standalone: true,
  imports: [FormsModule, NgbDatepickerModule],
  providers: [
    { provide: NgbDateParserFormatter, useClass: NgbDateDeParserFormatter },
  ],
})
export class DateQuestionComponent implements OnInit {
  @Input({ required: true }) question!: Question;

  answer = model<Partial<Answer>>();
  model = linkedSignal<NgbDateStruct | null>(() =>
    this.answer()?.answerDate
      ? this.toNgbDateStruct(this.answer()!.answerDate)
      : null,
  );

  answerValid!: boolean;
  reason = '';

  constructor() {
    effect(() => this.validate());
  }

  ngOnInit() {
    this.validate();
  }

  validate() {
    if (this.question.required && !this.answer()) {
      this.reason = 'Die Frage ist nicht optional.';
      this.answerValid = false;
      return;
    }
    this.reason = '';
    this.answerValid = true;
  }

  onDateSelect(date: NgbDateStruct) {
    const jsDate = new Date(date.year, date.month - 1, date.day);

    this.answer.update((a) => ({
      ...a,
      questionId: this.question.id,
      answerDate: jsDate,
    }));
    this.validate();
  }

  toNgbDateStruct(date: Date | undefined | null) {
    if (!date) date = new Date();
    else date = new Date(date);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }
}
