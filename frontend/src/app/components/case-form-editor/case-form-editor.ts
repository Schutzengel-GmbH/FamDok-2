import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CaseFormService } from 'src/app/services/case-form.service';
import { ToastService } from 'src/app/services/toast.service';
import { QuestionFormService } from 'src/app/services/question-form.service';
import { QuestionEditorComponent } from '../question-editor/question-editor';
import {
  CaseFormType,
  QuestionType,
} from '../../../../../shared/generated/prisma/enums';
import {
  CaseFormCreateInput,
  CaseFormUpdateInput,
} from '../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-case-form-editor',
  standalone: true,
  imports: [ReactiveFormsModule, QuestionEditorComponent],
  templateUrl: './case-form-editor.html',
  styleUrl: './case-form-editor.scss',
})
export class CaseFormEditorComponent implements OnInit {
  private fb = inject(FormBuilder);
  private caseFormService = inject(CaseFormService);
  private questionFormService = inject(QuestionFormService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  protected readonly QuestionType = QuestionType;
  protected readonly CaseFormType = CaseFormType;

  protected formId: string | null = null;
  protected isLoading = false;
  protected isSaving = false;

  protected form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    type: [CaseFormType.multiple as CaseFormType, Validators.required],
    containsPersonalData: [true],
    isPersonal: [false],
    questions: this.questionFormService.createQuestionsArray(),
  });

  /** Ids of questions removed from an existing form definition, to be deleted on save. */
  private deletedQuestionIds: string[] = [];

  get questions(): FormArray<FormGroup> {
    return this.form.get('questions') as FormArray<FormGroup>;
  }

  ngOnInit() {
    this.formId = this.activatedRoute.snapshot.paramMap.get('id');

    if (this.formId) {
      this.isLoading = true;
      this.caseFormService.getCaseForm(this.formId).subscribe((form) => {
        this.form.patchValue({
          name: form.name,
          type: form.type,
          containsPersonalData: form.containsPersonalData,
          isPersonal: form.isPersonal,
        });
        this.questionFormService.populateQuestions(
          this.questions,
          form.questions,
        );
        this.isLoading = false;
      });
    } else {
      this.questionFormService.addQuestion(this.questions);
    }
  }

  addQuestion() {
    this.questionFormService.addQuestion(this.questions);
  }

  removeQuestion(index: number) {
    this.questionFormService.removeQuestion(
      this.questions,
      index,
      this.deletedQuestionIds,
    );
  }

  moveQuestion(index: number, direction: -1 | 1) {
    this.questionFormService.moveQuestion(this.questions, index, direction);
  }

  save() {
    if (this.form.invalid || this.questions.length === 0) {
      this.form.markAllAsTouched();
      this.toast.show({
        title: 'Fehler',
        text: 'Bitte fülle alle Pflichtfelder aus und füge mindestens eine Frage hinzu.',
        severity: 'danger',
      });
      return;
    }

    const questionError = this.questionFormService.validateQuestions(
      this.questions,
    );
    if (questionError) {
      this.toast.show({ title: 'Fehler', text: questionError, severity: 'danger' });
      return;
    }

    this.isSaving = true;

    const request = this.formId
      ? this.caseFormService.updateCaseFormDefinition(
          this.formId,
          this.buildUpdateInput(),
        )
      : this.caseFormService.createCaseFormDefinition(this.buildCreateInput());

    request.subscribe({
      next: (res) => {
        this.isSaving = false;
        this.toast.show({
          title: 'Gespeichert',
          text: `Formular "${res.name}" wurde erfolgreich gespeichert.`,
          severity: 'success',
        });
        this.router.navigate(['einstellungen']);
      },
      error: () => {
        this.isSaving = false;
        this.toast.show({
          title: 'Fehler',
          text: 'Beim Speichern des Formulars ist ein Fehler aufgetreten.',
          severity: 'danger',
        });
      },
    });
  }

  cancel() {
    this.router.navigate(['einstellungen']);
  }

  private buildCreateInput(): CaseFormCreateInput {
    const { name, type, containsPersonalData, isPersonal } = this.form.value;
    return {
      name: name!,
      type: type!,
      containsPersonalData: containsPersonalData!,
      isPersonal: isPersonal!,
      questions: this.questionFormService.buildQuestionsCreateInput(
        this.questions,
      ),
    };
  }

  private buildUpdateInput(): CaseFormUpdateInput {
    const { name, type, containsPersonalData, isPersonal } = this.form.value;
    return {
      name: name!,
      type: type!,
      containsPersonalData: containsPersonalData!,
      isPersonal: isPersonal!,
      questions: this.questionFormService.buildQuestionsUpdateInput(
        this.questions,
        this.deletedQuestionIds,
      ),
    };
  }
}
