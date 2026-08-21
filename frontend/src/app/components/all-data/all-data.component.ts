import { Component, inject, input, signal } from '@angular/core';
import {
  FullCaseForm,
  FullCaseFormResponse,
} from '../../../../../shared/types';
import { CommonModule } from '@angular/common';
import {
  ActivateEvent,
  ColumnMode,
  NgxDatatableModule,
} from '@swimlane/ngx-datatable';
import {
  caseIdentifierPipe,
  userWithOrgPipe,
} from 'src/app/util/tableTransformPipes';
import { TruncatePipe } from 'src/app/pipes/truncate.pipe';
import { CaseFilter } from './filters/case-filter/case-filter.component';
import { CreatedByOrgFilter } from '../created-by-org-filter/created-by-org-filter.component';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, switchMap } from 'rxjs';
import { SelectQuestionFilter } from './filters/select-question-filter/select-question-filter.component';
import { TextQuestionFilter } from './filters/text-question-filter/text-question-filter.component';
import { NumQuestionFilter } from './filters/num-question-filter/num-question-filter.component';
import { DateQuestionFilter } from './filters/date-question-filter/date-question-filter.component';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { MeService } from 'src/app/services/me.service';
import { ToastService } from 'src/app/services/toast.service';
import { Router } from '@angular/router';
import {
  AnswerWhereInput,
  CaseFormResponseWhereInput,
  CaseWhereInput,
  UserWhereInput,
} from '../../../../../shared/generated/prisma/models';
import { Role } from '../../../../../shared/generated/prisma/enums';
import {
  AnswerModel as Answer,
  QuestionModel as Question,
} from '../../../../../shared/generated/prisma/models';
import { CaseFormService } from 'src/app/services/case-form.service';
import {
  CsvColumn,
  csvFilename,
  downloadCsv,
  toCsv,
} from 'src/app/util/csvExport';
import { downloadJson, jsonFilename, toJson } from 'src/app/util/jsonExport';
import {
  downloadXlsx,
  toXlsxBlob,
  XlsxColumn,
  xlsxFilename,
} from 'src/app/util/xlsxExport';

@Component({
  selector: 'app-all-data',
  templateUrl: './all-data.component.html',
  standalone: true,
  imports: [
    NgxDatatableModule,
    NgbTooltip,
    CommonModule,
    TruncatePipe,
    CaseFilter,
    CreatedByOrgFilter,
    SelectQuestionFilter,
    TextQuestionFilter,
    NumQuestionFilter,
    DateQuestionFilter,
  ],
})
export class AllDataComponent {
  private caseFormService = inject(CaseFormService);
  private meService = inject(MeService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected userWithOrgPipe = userWithOrgPipe;
  protected caseIdentifierPipe = caseIdentifierPipe;
  protected ColumnMode = ColumnMode;

  editable: Record<string, boolean> = {};

  protected currentUser = toSignal(this.meService.getMe());

  form = input.required<FullCaseForm>();
  filter = signal<CaseFormResponseWhereInput>({});

  /** Per-question answer filters, each of which must independently match some answer on the response. */
  private questionFilters = new Map<string, AnswerWhereInput>();

  form$ = toObservable(this.form);
  filter$ = toObservable(this.filter);

  rows = toSignal(
    combineLatest({
      form: this.form$,
      filter: this.filter$,
      user: this.meService.getMe(),
    }).pipe(
      switchMap((o) => {
        const filter: CaseFormResponseWhereInput = {
          ...o.filter,
          case:
            o.user.role === Role.User
              ? {
                  ...(o.filter.case as CaseWhereInput),
                  responsibleUsers: { some: { id: o.user.id } },
                }
              : o.user.role === Role.OrgController ||
                  o.user.role === Role.OrgCoordinator
                ? {
                    ...(o.filter.case as CaseWhereInput),
                    organisation: { id: o.user.organisationId! },
                  }
                : o.user.role === Role.SubOrgCoordinator
                  ? {
                      ...(o.filter.case as CaseWhereInput),
                      subOrganisationId: {
                        in: o.user.subOrganisations.map((so) => so.id),
                      },
                    }
                  : o.filter.case,
        };
        return this.caseFormService.getCaseFormResponsesForForm(
          o.form.id,
          filter,
        );
      }),
    ),
  );

  /** Whether the current user could actually save changes to this response - matches the
   * backend's canEditCaseFormResponse (Admin, or one of the case's responsibleUsers). Everyone
   * else (Controller/OrgController always, Coordinators for other org members' cases) only
   * gets a read-only view, since attempting to edit would just 403. */
  canEditRow(row: FullCaseFormResponse): boolean {
    const user = this.currentUser();
    if (!user) return false;
    if (user.role === Role.Admin) return true;
    return row.case.responsibleUsers.some((ru) => ru.id === user.id);
  }

  edit(id: string) {
    this.router.navigate(['responses', this.form().id], {
      queryParams: { id },
    });
  }

  inspect(id: string) {
    this.router.navigate(['responses', this.form().id], {
      queryParams: { id, readonly: true },
    });
  }

  caseFilterChange(filter: CaseWhereInput) {
    this.filter.update((f) => ({ ...f, case: filter }));
  }

  createdByOrgFilterChanged(filter: UserWhereInput) {
    this.filter.update((f) => ({ ...f, createdBy: filter }));
  }

  questionFilterChange(questionId: string, filter: AnswerWhereInput) {
    this.questionFilters.set(questionId, filter);

    // Each question's filter must match *some* answer independently - a single answer can
    // only ever belong to one question, so combining them inside a single `answers.some.AND`
    // would require one answer to satisfy every question's filter at once, which can never
    // happen. AND-ing separate `some` clauses at the top level is what actually intersects them.
    this.filter.update((f) => ({
      ...f,
      AND: [...this.questionFilters.values()].map((qf) => ({
        answers: { some: qf },
      })),
    }));
  }

  getValue(row: FullCaseFormResponse, question: Question) {
    const answer = row.answers.find((a) => a.questionId === question.id);
    if (!answer) return '---';

    switch (question.type) {
      case 'Integer':
        return answer.answerInt;
      case 'Float':
        return answer.answerNum;
      case 'Text':
      case 'Textarea':
        return answer.answerText;
      case 'Date':
        return answer.answerDate
          ? new Date(answer.answerDate).toLocaleDateString()
          : '';
      case 'Select':
        return answer.answerSelectId
          .map((id) => {
            const option = question.selectOptions.find((so) => so.id === id)!;
            if (!option.isOpen) return option.text;
            else return answer.answerText || '';
          })
          .join();
    }
  }

  protected exportCsv(): void {
    const columns: CsvColumn<FullCaseFormResponse>[] = [
      {
        header: 'Fall',
        value: (row) => this.caseIdentifierPipe.transform(row.case),
      },
      ...this.form().questions.map(
        (question): CsvColumn<FullCaseFormResponse> => ({
          header: question.text,
          value: (row) => this.getValue(row, question),
        }),
      ),
      {
        header: 'Erstellt von',
        value: (row) =>
          row.createdBy ? this.userWithOrgPipe.transform(row.createdBy) : '',
      },
    ];

    downloadCsv(csvFilename(this.form().name), toCsv(this.rows() ?? [], columns));
  }

  protected exportJson(): void {
    downloadJson(jsonFilename(this.form().name), toJson(this.rows() ?? []));
  }

  private getXlsxColumn(
    question: Question,
  ): Pick<XlsxColumn<FullCaseFormResponse>, 'value' | 'type'> {
    if (question.type === 'Integer' || question.type === 'Float') {
      return {
        value: (row) => {
          const value = this.getValue(row, question);
          return typeof value === 'number' ? value : undefined;
        },
        type: Number,
      };
    }
    if (question.type === 'Date') {
      return {
        value: (row) => {
          const answer = row.answers.find(
            (a) => a.questionId === question.id,
          );
          return answer?.answerDate ? new Date(answer.answerDate) : undefined;
        },
        type: Date,
      };
    }
    return { value: (row) => this.getValue(row, question) as string };
  }

  protected async exportXlsx(): Promise<void> {
    const columns: XlsxColumn<FullCaseFormResponse>[] = [
      {
        header: 'Fall',
        value: (row) => this.caseIdentifierPipe.transform(row.case),
      },
      ...this.form().questions.map(
        (question): XlsxColumn<FullCaseFormResponse> => ({
          header: question.text,
          ...this.getXlsxColumn(question),
        }),
      ),
      {
        header: 'Erstellt von',
        value: (row) =>
          row.createdBy ? this.userWithOrgPipe.transform(row.createdBy) : '',
      },
    ];

    downloadXlsx(
      xlsxFilename(this.form().name),
      await toXlsxBlob(this.rows() ?? [], columns),
    );
  }
}
