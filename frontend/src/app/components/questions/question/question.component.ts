import { Component, Input, model } from '@angular/core';
import { TextQuestionComponent } from '../text-question/text-question.component';
import { SelectQuestionComponent } from '../select-question/select-question.component';
import { DateQuestionComponent } from '../date-question/date-question.component';
import { IntegerQuestionComponent } from '../integer-question/integer-question.component';
import { FloatQuestionComponent } from '../float-question/float-question.component';
import { TextAreaQuestionComponent } from '../text-area-question/text-area-question';
import {
  AnswerModel as Answer,
  QuestionModel as Question,
} from '../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-question',
  templateUrl: './question.component.html',
  styleUrls: ['./question.component.scss'],
  standalone: true,
  imports: [
    TextQuestionComponent,
    SelectQuestionComponent,
    DateQuestionComponent,
    IntegerQuestionComponent,
    FloatQuestionComponent,
    TextAreaQuestionComponent,
  ],
})
export class QuestionComponent {
  @Input({ required: true }) question!: Question;

  answer = model<Partial<Answer>>();

  constructor() {}
}
