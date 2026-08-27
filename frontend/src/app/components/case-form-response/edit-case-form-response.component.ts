import {
  Component,
  inject,
  input,
  linkedSignal,
  model,
  OnInit,
} from '@angular/core';
import {
  FullCase,
  FullCaseForm,
  FullCaseFormResponse,
} from '../../../../../shared/types';
import { Router } from '@angular/router';
import { ToastService } from 'src/app/services/toast.service';
import {
  AnswerModel as Answer,
  CaregiverModel as Caregiver,
  ChildModel as Child,
} from '../../../../../shared/generated/prisma/models';
import { QuestionComponent } from '../questions/question/question.component';
import { SelectPersonComponent } from '../select-person-component/select-person-component';
import { CaseFormService } from 'src/app/services/case-form.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-edit-case-form-response',
  standalone: true,
  imports: [QuestionComponent, SelectPersonComponent],
  templateUrl: './edit-case-form-response.component.html',
})
export class EditCaseFormResponse implements OnInit {
  caseForm = input.required<FullCaseForm>();
  readOnly = input(false);
  response = model<FullCaseFormResponse>();

  case = model.required<FullCase>();
  person = linkedSignal<Child | Caregiver | undefined>(
    () => this.response()?.caregiver || this.response()?.child || undefined,
  );

  answers = linkedSignal(() => {
    if (!this.response()) return {};
    return (
      this.response()?.answers.reduce<Record<Answer['questionId'], Answer>>(
        (acc, cur) => ({ ...acc, [cur.questionId]: cur }),
        {},
      ) || {}
    );
  });

  private router = inject(Router);
  private caseFormService = inject(CaseFormService);
  private toastService = inject(ToastService);
  private dialogService = inject(ConfirmDialogService);

  ngOnInit() {
    if (this.caseForm().type === 'single')
      this.caseFormService
        .getCaseFormResponsesForForm(this.caseForm().id, {
          caseId: this.case().id,
        })
        .subscribe((responses) => {
          if (!responses || responses.length === 0) {
            this.answers.set({});
            this.response.set(undefined);
          } else {
            const answers = responses[0].answers.reduce<
              Record<Answer['questionId'], Answer>
            >((acc, cur) => ({ ...acc, [cur.questionId]: cur }), {});
            this.answers.set(answers);
            this.response.set(responses[0]);
          }
        });
  }

  protected saveResponse() {
    let answers: Answer[] = [];
    for (const questionId in this.answers()) {
      answers.push(this.answers()[questionId]);
    }

    this.caseFormService
      .saveResponse({
        responseId: this.response()?.id,
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
        console.log(res);
        this.toastService.show({
          title: 'Gespeichert',
          text: `Antwort für Familie ${res.case.family.name} gespeichert.`,
          severity: 'success',
        });
        this.router.navigate(['/']);
      });
  }

  protected delete() {
    const responseId = this.response()?.id;
    if (!responseId) return;

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
