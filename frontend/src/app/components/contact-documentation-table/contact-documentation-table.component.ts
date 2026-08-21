import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import {
  ActivateEvent,
  ColumnMode,
  NgxDatatableModule,
} from '@swimlane/ngx-datatable';
import { CaseFilter } from '../all-data/filters/case-filter/case-filter.component';
import { CreatedByOrgFilter } from '../created-by-org-filter/created-by-org-filter.component';
import {
  caseIdentifierPipe,
  datePipe,
  userWithOrgPipe,
} from 'src/app/util/tableTransformPipes';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, switchMap } from 'rxjs';
import { MeService } from 'src/app/services/me.service';
import { FullContactDocumentation } from '../../../../../shared/types';
import { DauerFilter } from './filters/dauer-filter/dauer-filter.component';
import { TruncatePipe } from '../../pipes/truncate.pipe';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { ThemenFilter } from './filters/themen-filter/themen-filter.component';
import { DateFilterContact } from './filters/date-filter/date-filter.component';
import { DateFieldFilter } from 'src/app/util/filterUtils';
import { EditText } from './inline-edit/edit-text/edit-text.component';
import { ToastService } from 'src/app/services/toast.service';
import { ZusammenfassungFilter } from './filters/text-filter/text-filter.component';
import { EditDate } from './inline-edit/edit-date/edit-date.component';
import { EditTopic } from './inline-edit/edit-topic/edit-topic.component';
import { EditDuration } from './inline-edit/edit-duration/edit-duration.component';
import { Router } from '@angular/router';
import {
  CaseWhereInput,
  ContactDocumentationWhereInput,
  UserWhereInput,
} from '../../../../../shared/generated/prisma/models';
import { ContactDocumentationService } from 'src/app/services/contact-documentation.service';
import { ContactDocumentationModel as ContactDocumentation } from '../../../../../shared/generated/prisma/models';
import { ContactDocumentationOptions } from '../../../../../shared/sharedGlobals';
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

type Editables = {
  date: boolean;
  response: {
    duration: boolean;
    artDerBetreuung: boolean;
    beratungsThemenAllgemein: boolean;
    beratungsThemenEltern: boolean;
    beratungsThemenKinder: boolean;
    zusammenfassung: boolean;
  };
};

@Component({
  selector: 'app-contact-documentation-table',
  standalone: true,
  templateUrl: './contact-documentation-table.component.html',
  imports: [
    AsyncPipe,
    NgbTooltip,
    NgxDatatableModule,
    CommonModule,
    CaseFilter,
    CreatedByOrgFilter,
    DauerFilter,
    TruncatePipe,
    ThemenFilter,
    DateFilterContact,
    EditText,
    ZusammenfassungFilter,
    EditDate,
    EditTopic,
    EditDuration,
  ],
})
export class ContactDocumentationTable {
  private documentationService = inject(ContactDocumentationService);
  private meService = inject(MeService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected user$ = this.meService.getMe();

  protected filter = signal<ContactDocumentationWhereInput>({});
  protected rows = toSignal(
    combineLatest({ user: this.user$, filter: toObservable(this.filter) }).pipe(
      switchMap(({ user, filter }) => {
        switch (user.role) {
          case 'Admin':
            return this.documentationService.getDocumentations(filter);
          case 'Controller':
            return this.documentationService.getDocumentations(filter);
          case 'OrgController':
          case 'OrgCoordinator':
            return this.documentationService.getDocumentations({
              ...filter,
              case: { organisation: { id: user.organisationId! } },
            });
          case 'SubOrgCoordinator':
            return this.documentationService.getDocumentations({
              ...filter,
              case: {
                subOrganisationId: {
                  in: user.subOrganisations.map((so) => so.id),
                },
              },
            });
          case 'User':
            return this.documentationService.getMyDocumentations(filter);
        }
      }),
    ),
  );

  protected ColumnMode = ColumnMode;
  protected userWithOrgPipe = userWithOrgPipe;
  protected caseIdentifierPipe = caseIdentifierPipe;
  protected datePipe = datePipe;

  protected currentUser = toSignal(this.user$);

  editable: Record<string, Editables> = {};

  /** Whether the current user could actually save changes to this contact documentation -
   * matches the backend's canEditCase (Admin, or one of the case's responsibleUsers). Everyone
   * else (Controller/OrgController always, Coordinators for other org members' cases) only
   * gets a read-only view, since attempting to edit would just 403. */
  canEditRow(row: FullContactDocumentation): boolean {
    const user = this.currentUser();
    if (!user) return false;
    if (user.role === 'Admin') return true;
    return row.case.responsibleUsers.some((ru) => ru.id === user.id);
  }

  userEvent(e: ActivateEvent<FullContactDocumentation>) {
    if (e.type === 'dblclick') {
      if (!this.canEditRow(e.row)) return;
      if (e.column?.prop === 'date') {
        if (!this.editable[e.row.id]?.date) this.toggleEdit(e.row.id, 'date');
      } else {
        const field = (e.column?.prop as string).split(
          '.',
        )[1] as keyof Editables['response'];
        if (!field || this.editable[e.row.id]?.response[field]) return;
        this.toggleEdit(e.row.id, field as keyof Editables['response']);
      }
    }
  }

  toggleEdit(id: string, field: keyof Editables['response'] | 'date') {
    if (!this.editable[id])
      this.editable[id] = {
        date: false,
        response: {
          duration: false,
          artDerBetreuung: false,
          beratungsThemenAllgemein: false,
          beratungsThemenEltern: false,
          beratungsThemenKinder: false,
          zusammenfassung: false,
        },
      };
    if (field === 'date') this.editable[id].date = !this.editable[id].date;
    else this.editable[id].response[field] = !this.editable[id].response[field];
  }

  edit(id: string, row: ContactDocumentation) {
    this.router.navigate(['contact-documentation', row.caseId, id]);
  }

  inspect(id: string, row: ContactDocumentation) {
    this.router.navigate(['contact-documentation', row.caseId, id], {
      queryParams: { readonly: true },
    });
  }

  saveDate(doc: FullContactDocumentation, value: Date) {
    let response = this.rows()?.find((r) => r.id === doc.id);

    response!.date = value;

    this.documentationService
      .updateDocumentation(doc.caseId, doc.id, { date: response?.date })
      .subscribe({
        next: () => {
          this.toggleEdit(doc.id, 'date');
          this.toast.show({
            title: 'Gespeichert',
            text: 'Neue Antwort gespeichert',
            severity: 'success',
          });
        },
        error: (e) => {
          this.toggleEdit(doc.id, 'date');
          this.toast.show({
            title: 'Fehler',
            text: e,
            severity: 'danger',
          });
        },
      });
  }

  saveResponse(
    doc: FullContactDocumentation,
    field: keyof Editables['response'] | 'date',
    value: any,
  ) {
    let response: ContactDocumentation | undefined = this.rows()?.find(
      (r) => r.id === doc.id,
    );

    if (!response) throw new Error();

    let storedValue = value;
    if (field === 'artDerBetreuung') {
      storedValue = (value as PrismaJson.SelectOption | null)?.id ?? null;
    } else if (
      field === 'beratungsThemenEltern' ||
      field === 'beratungsThemenKinder' ||
      field === 'beratungsThemenAllgemein'
    ) {
      storedValue =
        (value as PrismaJson.SelectOption[] | null)?.map((o) => o.id) ?? [];
    }

    // @ts-ignore; TODO: figure out proper typing here or otherwise de-hack this solution.
    // This roundabout update is necessary to provide instant view change
    response[field] = storedValue;

    this.documentationService
      .updateDocumentation(doc.caseId, doc.id, response)
      .subscribe({
        next: () => {
          this.toggleEdit(doc.id, field);
          this.toast.show({
            title: 'Gespeichert',
            text: 'Neue Antwort gespeichert',
            severity: 'success',
          });
        },
        error: (e) => {
          this.toggleEdit(doc.id, field);
          this.toast.show({
            title: 'Fehler',
            text: e,
            severity: 'danger',
          });
        },
      });
  }

  caseFilterChange(filter: CaseWhereInput) {
    this.filter.update((f) => ({ ...f, case: filter }));
  }

  createdByOrgFilterChanged(filter: UserWhereInput) {
    this.filter.update((f) => ({ ...f, createdBy: filter }));
  }

  dateFilterChanged(filter?: DateFieldFilter) {
    this.filter.update((f) => ({
      ...f,
      date: filter ? { [filter.filter]: filter.value } : undefined,
    }));
  }

  zusammenfassungFilterChanged(filter?: string) {
    if (!filter) return;
    this.filter.update((f) => ({
      ...f,
      zusammenfassung: { contains: filter, mode: 'insensitive' },
    }));
  }

  filterChanged: (
    ...args:
      | [field: 'duration', filter?: ContactDocumentationWhereInput['duration']]
      | [
          field:
            | 'artDerBetreuung'
            | 'beratungsThemenAllgemein'
            | 'beratungsThemenKinder'
            | 'beratungsThemenEltern',
          filter?: number,
        ]
  ) => void = (field, filter?) => {
    if (filter === undefined) return;
    switch (field) {
      case 'duration':
        this.filter.update((f) => ({ ...f, duration: filter }));
        break;
      case 'artDerBetreuung':
        this.filter.update((f) => ({ ...f, artDerBetreuung: filter }));
        break;
      case 'beratungsThemenAllgemein':
      case 'beratungsThemenEltern':
      case 'beratungsThemenKinder':
        this.filter.update((f) => ({ ...f, [field]: { has: filter } }));
    }
  };

  getSelectValue(
    row: FullContactDocumentation,
    field: keyof Omit<
      ContactDocumentation,
      | 'id'
      | 'userId'
      | 'date'
      | 'zusammenfassung'
      | 'dokumentation'
      | 'duration'
      | 'caseId'
    >,
  ) {
    if (field === 'artDerBetreuung')
      return (
        ContactDocumentationOptions['artDerBetreuung'].find(
          (o) => o.id === row.artDerBetreuung,
        )?.text ?? ''
      );
    return (row[field] as number[])
      .map(
        (id) =>
          ContactDocumentationOptions[field].find((o) => o.id === id)?.text,
      )
      .filter((text): text is string => !!text)
      .join(', ');
  }

  getSelectOption(id: number | null | undefined) {
    return ContactDocumentationOptions['artDerBetreuung'].find(
      (o) => o.id === id,
    );
  }

  getSelectOptions(
    field:
      | 'beratungsThemenEltern'
      | 'beratungsThemenKinder'
      | 'beratungsThemenAllgemein',
    ids: number[] | null | undefined,
  ) {
    return (ids ?? [])
      .map((id) => ContactDocumentationOptions[field].find((o) => o.id === id))
      .filter((o): o is PrismaJson.SelectOption => !!o);
  }

  getZusammenfassung(row: FullContactDocumentation) {
    return row.zusammenfassung;
  }

  columnEditable(field: keyof Editables['response'] | 'date') {
    for (const id in this.editable) {
      if (field === 'date' && this.editable[id].date) return true;
      if (this.editable[id].response[field as keyof Editables['response']])
        return true;
    }
    return false;
  }

  protected exportCsv(): void {
    const columns: CsvColumn<FullContactDocumentation>[] = [
      {
        header: 'Fall',
        value: (row) => this.caseIdentifierPipe.transform(row.case),
      },
      {
        header: 'Datum',
        value: (row) => (row.date ? this.datePipe.transform(row.date) : ''),
      },
      { header: 'Dauer der Beratung', value: (row) => row.duration },
      {
        header: 'Art der Beratung',
        value: (row) => this.getSelectValue(row, 'artDerBetreuung'),
      },
      {
        header: 'Beratungsthemen Eltern',
        value: (row) => this.getSelectValue(row, 'beratungsThemenEltern'),
      },
      {
        header: 'Beratungsthemen Kinder',
        value: (row) => this.getSelectValue(row, 'beratungsThemenKinder'),
      },
      {
        header: 'Beratungsthemen Allgemein',
        value: (row) => this.getSelectValue(row, 'beratungsThemenAllgemein'),
      },
      {
        header: 'Zusammenfassung',
        value: (row) => this.getZusammenfassung(row),
      },
      {
        header: 'Erstellt von',
        value: (row) =>
          row.createdBy ? this.userWithOrgPipe.transform(row.createdBy) : '',
      },
    ];

    downloadCsv(
      csvFilename('Kontaktdokumentationen'),
      toCsv(this.rows() ?? [], columns),
    );
  }

  protected exportJson(): void {
    downloadJson(
      jsonFilename('Kontaktdokumentationen'),
      toJson(this.rows() ?? []),
    );
  }

  protected async exportXlsx(): Promise<void> {
    const columns: XlsxColumn<FullContactDocumentation>[] = [
      {
        header: 'Fall',
        value: (row) => this.caseIdentifierPipe.transform(row.case),
      },
      {
        header: 'Datum',
        value: (row) => row.date ?? undefined,
        type: Date,
        width: 12,
      },
      {
        header: 'Dauer der Beratung',
        value: (row) => row.duration,
        type: Number,
      },
      {
        header: 'Art der Beratung',
        value: (row) => this.getSelectValue(row, 'artDerBetreuung'),
      },
      {
        header: 'Beratungsthemen Eltern',
        value: (row) => this.getSelectValue(row, 'beratungsThemenEltern'),
      },
      {
        header: 'Beratungsthemen Kinder',
        value: (row) => this.getSelectValue(row, 'beratungsThemenKinder'),
      },
      {
        header: 'Beratungsthemen Allgemein',
        value: (row) => this.getSelectValue(row, 'beratungsThemenAllgemein'),
      },
      {
        header: 'Zusammenfassung',
        value: (row) => this.getZusammenfassung(row),
      },
      {
        header: 'Erstellt von',
        value: (row) =>
          row.createdBy ? this.userWithOrgPipe.transform(row.createdBy) : '',
      },
    ];

    downloadXlsx(
      xlsxFilename('Kontaktdokumentationen'),
      await toXlsxBlob(this.rows() ?? [], columns),
    );
  }
}
