import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { GeneralFormService } from 'src/app/services/general-form.service';
import { ToastService } from 'src/app/services/toast.service';
import { QuestionFormService } from 'src/app/services/question-form.service';
import { QuestionEditorComponent } from '../question-editor/question-editor';
import { QuestionType } from '../../../../../shared/generated/prisma/enums';
import {
  GeneralFormCreateInput,
  GeneralFormUpdateInput,
} from '../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-general-form-editor',
  standalone: true,
  imports: [ReactiveFormsModule, QuestionEditorComponent],
  templateUrl: './general-form-editor.html',
  styleUrl: './general-form-editor.scss',
})
export class GeneralFormEditorComponent implements OnInit {
  private fb = inject(FormBuilder);
  private formService = inject(GeneralFormService);
  private questionFormService = inject(QuestionFormService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  protected readonly QuestionType = QuestionType;

  protected formId: string | null = null;
  protected isLoading = false;
  protected isSaving = false;

  protected form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
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
      this.formService.getDefinition(this.formId).subscribe({
        next: (form) => {
          this.form.patchValue({ name: form.name });
          this.questionFormService.populateQuestions(
            this.questions,
            form.questions,
          );
          this.isLoading = false;
        },
        error: (err) => {
          console.error(err);
          this.toast.show({
            title: 'Fehler',
            text: `Beim Laden der Familie ist ein Fehler aufgetreten: ${err.message ? err.message : err}`,
            severity: 'danger',
          });
        },
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
      this.toast.show({
        title: 'Fehler',
        text: questionError,
        severity: 'danger',
      });
      return;
    }

    this.isSaving = true;
    const name = this.form.value.name!;

    const request = this.formId
      ? this.formService.updateDefinition(
          this.formId,
          this.buildUpdateInput(name),
        )
      : this.formService.createDefinition(this.buildCreateInput(name));

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

  private buildCreateInput(name: string): GeneralFormCreateInput {
    return {
      name,
      questions: this.questionFormService.buildQuestionsCreateInput(
        this.questions,
      ),
    };
  }

  private buildUpdateInput(name: string): GeneralFormUpdateInput {
    return {
      name,
      questions: this.questionFormService.buildQuestionsUpdateInput(
        this.questions,
        this.deletedQuestionIds,
      ),
    };
  }
}
