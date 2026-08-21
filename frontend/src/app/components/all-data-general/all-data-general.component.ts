import { Component, inject, input, signal } from '@angular/core';
import {
  FullGeneralForm,
  FullGeneralFormResponse,
} from '../../../../../shared/types';
import { CommonModule } from '@angular/common';
import { ColumnMode, NgxDatatableModule } from '@swimlane/ngx-datatable';
import { userWithOrgPipe } from 'src/app/util/tableTransformPipes';
import { TruncatePipe } from 'src/app/pipes/truncate.pipe';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, switchMap } from 'rxjs';
import { SelectQuestionFilter } from '../all-data/filters/select-question-filter/select-question-filter.component';
import { TextQuestionFilter } from '../all-data//filters/text-question-filter/text-question-filter.component';
import { NumQuestionFilter } from '../all-data//filters/num-question-filter/num-question-filter.component';
import { DateQuestionFilter } from '../all-data//filters/date-question-filter/date-question-filter.component';
import { CreatedByOrgFilter } from '../created-by-org-filter/created-by-org-filter.component';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { MeService } from 'src/app/services/me.service';
import { Router } from '@angular/router';
import { GeneralFormService } from 'src/app/services/general-form.service';
import {
  AnswerWhereInput,
  GeneralFormResponseWhereInput,
  UserWhereInput,
} from '../../../../../shared/generated/prisma/models';
import { combineWhereFilters } from 'src/app/util/filterUtils';
import { Role } from '../../../../../shared/generated/prisma/enums';
import { QuestionModel as Question } from '../../../../../shared/generated/prisma/models';
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
  selector: 'app-allgeneral-data',
  templateUrl: './all-data-general.component.html',
  standalone: true,
  imports: [
    NgxDatatableModule,
    NgbTooltip,
    CommonModule,
    TruncatePipe,
    CreatedByOrgFilter,
    SelectQuestionFilter,
    TextQuestionFilter,
    NumQuestionFilter,
    DateQuestionFilter,
  ],
})
export class AllDataGeneralComponent {
  private formService = inject(GeneralFormService);
  private meService = inject(MeService);
  private router = inject(Router);

  protected userWithOrgPipe = userWithOrgPipe;
  protected ColumnMode = ColumnMode;

  protected currentUser = toSignal(this.meService.getMe());

  form = input.required<FullGeneralForm>();
  filter = signal<GeneralFormResponseWhereInput>({});
  /** createdBy filter picked via the "Erstellt von" column's org/suborg filter - kept separate
   * from `filter` since the role-based scoping below also targets `createdBy` and would
   * otherwise silently overwrite it instead of both applying. */
  private createdByOrgFilter = signal<UserWhereInput>({});

  /** Per-question answer filters, each of which must independently match some answer on the response. */
  private questionFilters = new Map<string, AnswerWhereInput>();

  form$ = toObservable(this.form);
  filter$ = toObservable(this.filter);
  createdByOrgFilter$ = toObservable(this.createdByOrgFilter);

  rows = toSignal(
    combineLatest({
      form: this.form$,
      filter: this.filter$,
      createdByOrgFilter: this.createdByOrgFilter$,
      user: this.meService.getMe(),
    }).pipe(
      switchMap((o) => {
        const roleFilter: UserWhereInput | undefined =
          o.user.role === Role.User
            ? { id: o.user.id }
            : o.user.role === Role.OrgController ||
                o.user.role === Role.OrgCoordinator
              ? { organisationId: o.user.organisationId! }
              : o.user.role === Role.SubOrgCoordinator
                ? {
                    subOrganisations: {
                      some: {
                        id: { in: o.user.subOrganisations.map((so) => so.id) },
                      },
                    },
                  }
                : undefined;
        const filter: GeneralFormResponseWhereInput = {
          ...o.filter,
          createdBy: combineWhereFilters(roleFilter, o.createdByOrgFilter),
        };
        return this.formService.getResponsesForDefinition(o.form.id, filter);
      }),
    ),
  );

  /** Whether the current user could actually save changes to this response - matches the
   * backend's canEditGeneralFormResponse (Admin, or the response's own creator). Everyone else
   * only gets a read-only view, since attempting to edit would just 403. */
  canEditRow(row: FullGeneralFormResponse): boolean {
    const user = this.currentUser();
    if (!user) return false;
    if (user.role === Role.Admin) return true;
    return row.createdBy?.id === user.id;
  }

  edit(id: string) {
    this.router.navigate(['general-responses', id], {
      queryParams: { definitionId: this.form().id },
    });
  }

  inspect(id: string) {
    this.router.navigate(['general-responses', id], {
      queryParams: { definitionId: this.form().id, readonly: true },
    });
  }

  createdByOrgFilterChanged(filter: UserWhereInput) {
    this.createdByOrgFilter.set(filter);
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

  getValue(row: FullGeneralFormResponse, question: Question) {
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
    const columns: CsvColumn<FullGeneralFormResponse>[] = [
      ...this.form().questions.map(
        (question): CsvColumn<FullGeneralFormResponse> => ({
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
  ): Pick<XlsxColumn<FullGeneralFormResponse>, 'value' | 'type'> {
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
    const columns: XlsxColumn<FullGeneralFormResponse>[] = [
      ...this.form().questions.map(
        (question): XlsxColumn<FullGeneralFormResponse> => ({
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
