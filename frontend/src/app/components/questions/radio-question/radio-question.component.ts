import {
  Component,
  Input,
  computed,
  linkedSignal,
  model,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AnswerModel as Answer,
  QuestionModel as Question,
} from '../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-radio-question',
  standalone: true,
  templateUrl: './radio-question.component.html',
  styleUrls: ['./radio-question.component.scss'],
  imports: [CommonModule, FormsModule],
})
export class RadioQuestionComponent implements OnInit {
  @Input({ required: true }) question!: Question;

  answer = model<Partial<Answer>>();
  selected = linkedSignal<number | undefined>(() =>
    this.answer()?.answerSelectId?.at(0),
  );

  answerValid!: boolean;
  reason = '';

  ngOnInit() {
    this.validate();
  }

  onSelect(id: number) {
    this.answer.update(() => ({
      answerSelectId: [id],
    }));
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
}
