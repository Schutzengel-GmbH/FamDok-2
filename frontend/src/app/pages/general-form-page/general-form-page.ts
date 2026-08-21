import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GeneralFormService } from 'src/app/services/general-form.service';
import {
  FullGeneralForm,
  FullGeneralFormResponse,
} from '../../../../../shared/types';
import { QuestionComponent } from 'src/app/components/questions/question/question.component';
import { validateAnswer } from 'src/app/util/validation';
import { ToastService } from 'src/app/services/toast.service';
import { HttpErrorResponse } from '@angular/common/http';
import { AnswerModel as Answer } from '../../../../../shared/generated/prisma/models';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-general-form-page',
  imports: [QuestionComponent],
  standalone: true,
  templateUrl: './general-form-page.html',
  styleUrl: './general-form-page.css',
})
export class GeneralFormPage {
  private formService = inject(GeneralFormService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private dialogService = inject(ConfirmDialogService);

  protected form!: FullGeneralForm;
  protected answers: Record<string, Answer> = {};
  protected response: FullGeneralFormResponse | undefined;
  protected readOnly =
    this.activatedRoute.snapshot.queryParamMap.get('readonly') === 'true';

  constructor() {
    const responseId = this.activatedRoute.snapshot.paramMap.get('id')!;
    const definitionId =
      this.activatedRoute.snapshot.queryParamMap.get('definitionId');

    if (responseId) {
      this.formService.getResponse(responseId).subscribe((r) => {
        if (!r) {
          this.router.navigate(['error'], {
            queryParams: {
              code: '404',
              title: 'Not Found',
              message: 'Antwort nicht gefunden',
            },
          });
          return;
        }
        this.response = r;
        this.answers = r.answers.reduce<Record<string, Answer>>(
          (acc, cur) => ({ ...acc, [cur.questionId]: cur }),
          {},
        );
        this.formService
          .getDefinition(r.generalFormId)
          .subscribe((d) => (this.form = d));
      });
    } else if (definitionId) {
      this.formService.getDefinition(definitionId).subscribe((d) => {
        this.form = d;
      });
    }
  }

  validate() {
    return this.form.questions.reduce((prev, q) => {
      return prev && validateAnswer(q, this.answers[q.id]);
    }, true);
  }

  protected save() {
    let answers: Answer[] = [];
    for (const questionId in this.answers) {
      answers.push(this.answers[questionId]);
    }

    this.formService
      .saveResponse({
        responseId: this.response?.id,
        formId: this.form.id,
        answers,
      })
      .subscribe({
        next: (_res) => {
          this.toast.show({
            title: 'Gespeichert',
            text: `Antwort zu ${this.form.name} erfolgreich gespeichert.`,
            severity: 'success',
          });
          this.router.navigate(['']);
        },
        error: (err) => {
          this.toast.show({
            title: 'Fehler',
            text:
              'Beim Speichern ist ein Fehler aufgetreten: ' + err.message
                ? err.message
                : err,
            severity: 'danger',
          });

          this.router.navigate(['error'], {
            queryParams: {
              code: err instanceof HttpErrorResponse ? err.status : 0,
              title: err instanceof HttpErrorResponse ? err.name : 'Fehler',
              message:
                err instanceof HttpErrorResponse
                  ? err.message
                  : (err.message ?? err),
            },
          });
        },
      });
  }

  protected delete() {
    const responseId = this.response?.id;
    if (!responseId) return;

    this.dialogService.open({
      title: 'Antwort löschen?',
      text: 'Soll die Antwort wirklich endgültig gelöscht werden?',
      confirmAction: () => {
        this.formService.deleteResponse(responseId).subscribe(() => {
          this.toast.show({
            title: 'Gelöscht',
            text: `Antwort gelöscht.`,
            severity: 'success',
          });
          this.router.navigate(['/']);
        });
      },
    });
  }
}
