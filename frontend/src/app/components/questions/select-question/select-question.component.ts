import { Component, Input, model, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectMultipleComponent } from './select-multiple/select-multiple';
import { SelectOneComponent } from './select-one/select-one';
import {
  AnswerModel as Answer,
  QuestionModel as Question,
} from '../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-select-question',
  templateUrl: './select-question.component.html',
  styleUrls: ['./select-question.component.scss'],
  standalone: true,
  imports: [FormsModule, SelectMultipleComponent, SelectOneComponent],
})
export class SelectQuestionComponent {
  @Input({ required: true }) question!: Question;

  answer = model<Partial<Answer>>();
  answerValid = model<boolean>();

  constructor() {}
}
