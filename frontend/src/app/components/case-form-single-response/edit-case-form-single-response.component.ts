import { Component, inject, input, model, OnInit } from '@angular/core';
import { FullCase, FullCaseForm } from '../../../../../shared/types';
import { Router } from '@angular/router';
import { ToastService } from 'src/app/services/toast.service';
import { QuestionComponent } from '../questions/question/question.component';
import { SelectPersonComponent } from '../select-person-component/select-person-component';
import {
  AnswerModel as Answer,
  CaregiverModel as Caregiver,
  ChildModel as Child,
} from '../../../../../shared/generated/prisma/models';
import { CaseFormService } from 'src/app/services/case-form.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-edit-case-form-single-response',
  standalone: true,
  imports: [QuestionComponent, SelectPersonComponent],
  templateUrl: './edit-case-form-single-response.component.html',
})
export class EditCaseFormSingleResponse implements OnInit {
  caseForm = input.required<FullCaseForm>();
  readOnly = input(false);

  case = model.required<FullCase>();
  person = model<Child | Caregiver>();

  responseId!: string | undefined;
  protected answers: Record<Answer['questionId'], Answer> = {};

  private router = inject(Router);
  private caseFormService = inject(CaseFormService);
  private toastService = inject(ToastService);
  private dialogService = inject(ConfirmDialogService);

  ngOnInit() {
    this.caseFormService
      .getCaseFormResponsesForForm(this.caseForm().id, {
        caseId: this.case().id,
      })
      .subscribe((responses) => {
        if (!responses || responses.length === 0) {
          this.answers = {};
          this.responseId = undefined;
        } else {
          this.answers = responses[0].answers.reduce<
            Record<Answer['questionId'], Answer>
          >((acc, cur) => ({ ...acc, [cur.questionId]: cur }), {});
          this.responseId = responses[0].id;
        }
      });
  }

  protected saveResponse() {
    let answers: Answer[] = [];
    for (const questionId in this.answers) {
      answers.push(this.answers[questionId]);
    }

    this.caseFormService
      .saveResponse({
        responseId: this.responseId,
        formId: this.caseForm().id,
        caseId: this.case().id,
        answers,
        caregiverId:
          this.person() && this.person()?.hasOwnProperty('relation')
            ? this.person()?.id
            : undefined,
        childId:
          this.person() && !this.person()?.hasOwnProperty('relation')
            ? this.person()?.id
            : undefined,
      })
      .subscribe((res) => {
        this.toastService.show({
          title: 'Gespeichert',
          text: `Antwort für Familie ${res.case.family?.name ?? ''} gespeichert.`,
          severity: 'success',
        });
        this.router.navigate(['/']);
      });
  }

  protected delete() {
    if (!this.responseId) return;
    const responseId = this.responseId;

    this.dialogService.open({
      title: 'Antwort löschen?',
      text: 'Soll die Antwort wirklich endgültig gelöscht werden?',
      confirmAction: () => {
        this.caseFormService
          .deleteCaseFormResponse(responseId)
          .subscribe(() => {
            this.toastService.show({
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
