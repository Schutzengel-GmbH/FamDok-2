import { Component, Input } from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { QuestionType } from '../../../../../shared/generated/prisma/enums';
import { SelectOptionsEditorComponent } from '../select-options-editor/select-options-editor';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  Text: 'Text',
  Integer: 'Ganzzahl',
  Float: 'Kommazahl',
  Date: 'Datum',
  Select: 'Auswahl',
  Textarea: 'Mehrzeiliger Text',
};

@Component({
  selector: 'app-question-editor',
  standalone: true,
  imports: [ReactiveFormsModule, SelectOptionsEditorComponent],
  templateUrl: './question-editor.html',
  styleUrl: './question-editor.scss',
})
export class QuestionEditorComponent {
  @Input({ required: true }) questionGroup!: FormGroup;

  protected readonly QuestionType = QuestionType;
  protected readonly questionTypes = Object.values(QuestionType);

  get selectOptions(): FormArray<FormGroup> {
    return this.questionGroup.get('selectOptions') as FormArray<FormGroup>;
  }

  get type(): QuestionType {
    return this.questionGroup.get('type')!.value;
  }

  get numberStep(): string {
    return this.type === QuestionType.Float ? 'any' : '1';
  }

  typeLabel(type: QuestionType): string {
    return QUESTION_TYPE_LABELS[type];
  }
}
