import { inject, Injectable } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { QuestionType } from '../../../../shared/generated/prisma/enums';
import { QuestionModel as Question } from '../../../../shared/generated/prisma/models';

export interface QuestionFormValue {
  id: string | null;
  type: QuestionType;
  text: string;
  required: boolean;
  multiple: boolean;
  min: number | null;
  max: number | null;
  textAreaRows: number;
  selectOptions: PrismaJson.SelectOption[];
}

function minMaxValidator(group: AbstractControl): ValidationErrors | null {
  const min = group.get('min')!.value;
  const max = group.get('max')!.value;
  if (min !== null && max !== null && min > max) {
    return { minGreaterThanMax: true };
  }
  return null;
}

/**
 * Builds and serializes the reactive-forms representation of a form's question list.
 * Shared between the general-form and case-form editors so question/select-option
 * editing logic (including select-option/min-max handling) isn't duplicated between them.
 */
@Injectable({ providedIn: 'root' })
export class QuestionFormService {
  private fb = inject(FormBuilder);

  createQuestionsArray(questions?: Question[]): FormArray<FormGroup> {
    const array = this.fb.array<FormGroup>([]);
    if (questions) this.populateQuestions(array, questions);
    return array;
  }

  /** Appends form groups for existing questions (e.g. after loading a form for editing). */
  populateQuestions(array: FormArray<FormGroup>, questions: Question[]) {
    for (const question of questions) {
      array.push(this.buildQuestionGroup(question));
    }
  }

  buildQuestionGroup(question?: Question): FormGroup {
    return this.fb.group(
      {
        id: [question?.id ?? null],
        type: [question?.type ?? QuestionType.Text, Validators.required],
        text: [
          question?.text ?? '',
          [Validators.required, Validators.minLength(1)],
        ],
        required: [question?.required ?? false],
        multiple: [question?.multiple ?? false],
        min: [question?.min ?? null],
        max: [question?.max ?? null],
        textAreaRows: [question?.textAreaRows ?? 3, Validators.min(1)],
        selectOptions: this.fb.array<FormGroup>(
          (question?.selectOptions ?? []).map((option) =>
            this.buildOptionGroup(option),
          ),
        ),
      },
      { validators: minMaxValidator },
    );
  }

  private buildOptionGroup(option: PrismaJson.SelectOption): FormGroup {
    return this.fb.group({
      id: [option.id],
      text: [option.text, Validators.required],
      isOpen: [option.isOpen ?? false],
    });
  }

  addQuestion(array: FormArray<FormGroup>) {
    array.push(this.buildQuestionGroup());
  }

  /** Removes the question at `index`, tracking its id (if any) so it can be deleted on save. */
  removeQuestion(
    array: FormArray<FormGroup>,
    index: number,
    deletedQuestionIds: string[],
  ) {
    const id = array.at(index).get('id')!.value as string | null;
    if (id) deletedQuestionIds.push(id);
    array.removeAt(index);
  }

  moveQuestion(array: FormArray<FormGroup>, index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= array.length) return;

    const control = array.at(index);
    array.removeAt(index);
    array.insert(target, control);
  }

  /** Returns a German error message if any question is invalid, otherwise null. */
  validateQuestions(array: FormArray<FormGroup>): string | null {
    for (const control of array.controls) {
      if (control.errors?.['minGreaterThanMax']) {
        return 'Der Minimalwert darf nicht größer als der Maximalwert sein.';
      }

      const value = control.value as QuestionFormValue;
      if (value.type !== QuestionType.Select) continue;

      if (value.selectOptions.length === 0) {
        return 'Auswahlfragen benötigen mindestens eine Antwortoption.';
      }

      if (value.selectOptions.some((o) => !o.text?.trim())) {
        return 'Antwortoptionen dürfen nicht leer sein.';
      }
    }

    return null;
  }

  private toQuestionData(question: QuestionFormValue, order: number) {
    const isSelect = question.type === QuestionType.Select;
    const isTextarea = question.type === QuestionType.Textarea;
    const isNumeric =
      question.type === QuestionType.Integer ||
      question.type === QuestionType.Float;

    return {
      type: question.type,
      text: question.text,
      order,
      required: question.required,
      multiple: isSelect ? question.multiple : null,
      textAreaRows: isTextarea ? question.textAreaRows : null,
      min: isNumeric ? question.min : null,
      max: isNumeric ? question.max : null,
      selectOptions: isSelect
        ? question.selectOptions.map((o) => ({
            id: o.id,
            text: o.text,
            ...(o.isOpen ? { isOpen: true } : {}),
          }))
        : [],
    };
  }

  /** Nested-write input for creating all questions of a brand new form. */
  buildQuestionsCreateInput(array: FormArray<FormGroup>) {
    return {
      createMany: {
        data: array.controls.map((c, order) =>
          this.toQuestionData(c.value as QuestionFormValue, order),
        ),
      },
    };
  }

  /**
   * Nested-write input for updating an existing form's questions: existing questions are
   * updated in place (so answers referencing them survive), new ones are created, and only
   * questions the admin actually removed are deleted (cascading their answers). Each
   * question's `order` reflects its current position in `array` (captured here, before
   * splitting into update/create groups) so reordering in the editor persists.
   */
  buildQuestionsUpdateInput(
    array: FormArray<FormGroup>,
    deletedQuestionIds: string[],
  ) {
    const questions = array.controls.map((c, order) => ({
      value: c.value as QuestionFormValue,
      order,
    }));
    const toUpdate = questions.filter((q) => q.value.id);
    const toCreate = questions.filter((q) => !q.value.id);

    return {
      ...(toUpdate.length && {
        update: toUpdate.map((q) => ({
          where: { id: q.value.id! },
          data: this.toQuestionData(q.value, q.order),
        })),
      }),
      ...(toCreate.length && {
        createMany: {
          data: toCreate.map((q) => this.toQuestionData(q.value, q.order)),
        },
      }),
      ...(deletedQuestionIds.length && {
        deleteMany: { id: { in: deletedQuestionIds } },
      }),
    };
  }
}
