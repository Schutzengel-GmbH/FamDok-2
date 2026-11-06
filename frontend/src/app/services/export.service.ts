import { inject, Injectable, Injector } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Content, StyleDictionary } from 'pdfmake/interfaces';
import {
  FullCase,
  FullCaseForm,
  FullCaseFormResponse,
  FullContactDocumentation,
  FullUser,
} from '../../../../shared/types';
import { ContactDocumentationOptions } from '../../../../shared/sharedGlobals';
import {
  FAMILIENSTAND_LABELS,
  GENDER_LABELS,
  RELATION_LABELS,
} from '../../../../shared/utils/labels';
import { CSV_BOM, CsvColumn, toCsv } from '../../../../shared/utils/csv';
import { getAnswerValue } from '../../../../shared/utils/answerValue';
import {
  caseExportFilename,
  safeFilename,
  stammdatenFilename,
} from '../../../../shared/utils/filename';
import { CaseService } from './case.service';
import { ContactDocumentationService } from './contact-documentation.service';
import { CaseFormService } from './case-form.service';
import { MeService } from './me.service';
import { triggerBlobDownload } from './document.service';

const NO_VALUE = 'Keine Angabe';

const STYLES: StyleDictionary = {
  header: { fontSize: 18, bold: true, marginTop: 24, marginBottom: 6 },
  subheader: { fontSize: 15, bold: true, marginTop: 12, marginBottom: 6 },
  text: { fontSize: 11, marginBottom: 6 },
  quote: { italics: true },
  small: { fontSize: 8 },
};

/** DD.MM.YYYY in German local time. */
function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** HH:MM in German local time. */
function formatTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** YYYY-MM-DD in German local time, for file names. */
function isoDay(d: Date | string | null | undefined): string {
  if (!d) return 'ohne-Datum';
  return new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 10);
}

/** "Ja"/"Nein", or "Keine Angabe" for an unset value. */
function yesNo(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return NO_VALUE;
  return value ? 'Ja' : 'Nein';
}

/** A bold label next to its value in a key-value table. */
function row(label: string, value: string | null | undefined) {
  return [{ text: label, bold: true }, { text: value || NO_VALUE }];
}

/** A borderless two-column table of labelled values. */
function keyValueTable(rows: ReturnType<typeof row>[]): Content {
  return { table: { widths: [180, '*'], body: rows }, layout: 'noBorders', marginBottom: 6 };
}

/** A table of people (children, caregivers), or "Keine Angabe" if there are none. */
function personTable(headers: string[], rows: string[][]): Content {
  if (rows.length === 0) return { text: NO_VALUE, style: 'text' };
  return {
    table: {
      headerRows: 1,
      widths: headers.map(() => '*'),
      body: [headers.map((h) => ({ text: h, bold: true })), ...rows],
    },
    layout: 'lightHorizontalLines',
    marginBottom: 6,
  };
}

/** "Vorname Nachname", or the email address if the name is unknown. */
function userName(u: Pick<FullUser, 'firstName' | 'lastName' | 'email'>): string {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
}

/** "Erstellt von: Vorname Nachname (Org – SubOrg)", like the user pipe. */
function createdByLine(user: FullUser | null | undefined): Content {
  if (!user) return { text: 'Erstellt von: (unbekannt)' };
  const subOrgNames = user.subOrganisations?.map((so) => so.name).join(', ');
  const orgLabel = [user.organisation?.name, subOrgNames].filter(Boolean).join(' – ');
  return { text: `Erstellt von: ${orgLabel ? `${userName(user)} (${orgLabel})` : userName(user)}` };
}

/**
 * Exports of a case: the Stammdaten PDF, one PDF per contact documentation, and the full case
 * file as a ZIP. They used to be built on the server; with the personal data encrypted, only the
 * browser can read it, so they are built here from the decrypted data. pdfmake and JSZip are
 * large, so they are loaded on first use.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  // resolved on first export, so components that only offer a download button stay light
  private injector = inject(Injector);
  private get caseService() {
    return this.injector.get(CaseService);
  }
  private get documentationService() {
    return this.injector.get(ContactDocumentationService);
  }
  private get caseFormService() {
    return this.injector.get(CaseFormService);
  }
  private get meService() {
    return this.injector.get(MeService);
  }

  /** Downloads the Stammdaten PDF of a case. */
  async downloadStammdaten(caseId: string): Promise<void> {
    const c = await firstValueFrom(this.caseService.getCase(caseId));
    triggerBlobDownload(stammdatenFilename(c.family?.name), await this.stammdatenPdf(c));
  }

  /** Downloads the PDF of one contact documentation. */
  async downloadContactDocumentation(caseId: string, docId: string): Promise<void> {
    const doc = await firstValueFrom(this.documentationService.getDocumentation(caseId, docId));
    triggerBlobDownload(
      `Kontaktdokumentation-${isoDay(doc.date)}.pdf`,
      await this.contactDocumentationPdf(doc),
    );
  }

  /**
   * Downloads the case file: Stammdaten PDF, one PDF per contact documentation and one CSV per
   * case form, in a ZIP.
   */
  async downloadCaseExport(caseId: string): Promise<void> {
    const c = await firstValueFrom(this.caseService.getCase(caseId));
    triggerBlobDownload(caseExportFilename(c.family?.name), await this.caseExportZip(c));
  }

  /** Renders content with the app's PDF styles. */
  private async render(content: Content[]): Promise<Blob> {
    const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ]);
    pdfMake.addVirtualFileSystem(vfs);
    return pdfMake
      .createPdf({ content, styles: STYLES, defaultStyle: { font: 'Roboto' } })
      .getBlob();
  }

  /** "Org – SubOrg" of a case, from the user's own organisation. */
  private async orgLabel(c: FullCase): Promise<string> {
    const me = await firstValueFrom(this.meService.getMe());
    if (!me.organisation || me.organisation.id !== c.organisationId) return '';
    const sub = me.organisation.subOrganisations?.find((s) => s.id === c.subOrganisationId);
    return [me.organisation.name, sub?.name].filter(Boolean).join(' – ');
  }

  /** The Stammdaten PDF of a (decrypted) case. */
  async stammdatenPdf(c: FullCase): Promise<Blob> {
    const family = c.family;
    const address = family?.adress;
    const addressString = address
      ? `${address.street ?? ''} ${address.number ?? ''}, ${address.plz ?? ''} ${address.city ?? ''}`
      : null;
    const migration =
      c.migrationBackground && c.specificMigrationBackground
        ? `Ja, ${c.specificMigrationBackground}`
        : yesNo(c.migrationBackground);

    const caregivers = (family?.caregiver ?? []).map((cg) => [
      [cg.name, cg.lastName].filter(Boolean).join(' '),
      cg.relation ? RELATION_LABELS[cg.relation] : '',
      cg.gender ? GENDER_LABELS[cg.gender] : '',
      formatDate(cg.dateOfBirth),
    ]);
    const children = (family?.children ?? []).map((ch) => [
      [ch.name, ch.lastName].filter(Boolean).join(' '),
      ch.gender ? GENDER_LABELS[ch.gender] : '',
      formatDate(ch.dateOfBirth),
    ]);

    return this.render([
      { text: `Stammdaten Familie ${family?.name || '(kein Name)'}`, style: 'header' },
      { text: 'Fall', style: 'subheader' },
      keyValueTable([
        row('Beginn', formatDate(c.startedAt)),
        ...(c.closedAt ? [row('Abschluss', formatDate(c.closedAt))] : []),
        row('Organisation', await this.orgLabel(c)),
        row('Ort', [c.plz, c.city].filter(Boolean).join(' ')),
        row('Familienstand', c.familienstand ? FAMILIENSTAND_LABELS[c.familienstand] : null),
        row('Migrationshintergrund', migration),
        row('Beide Elternteile involviert', yesNo(c.partnerInvolved)),
        row('Beim Jugendamt bekannt', yesNo(c.bekanntJA)),
        row('Verantwortlich', c.responsibleUsers.map(userName).join(', ')),
      ]),
      { text: 'Familie', style: 'subheader' },
      keyValueTable([
        row('Adresse', addressString),
        row('Telefon', family?.phone),
        row('Weitere Telefonnummern', family?.additionalPhones?.join(', ')),
        row('Notiz', family?.note),
      ]),
      { text: 'Bezugspersonen', style: 'subheader' },
      personTable(['Name', 'Beziehung', 'Geschlecht', 'Geburtsdatum'], caregivers),
      { text: 'Kinder', style: 'subheader' },
      personTable(['Name', 'Geschlecht', 'Geburtsdatum'], children),
    ]);
  }

  /** The PDF of one (decrypted) contact documentation. */
  async contactDocumentationPdf(doc: FullContactDocumentation): Promise<Blob> {
    const label = (key: keyof typeof ContactDocumentationOptions, id: number) =>
      ContactDocumentationOptions[key].find((o) => o.id === id)?.text || '';
    const art =
      ContactDocumentationOptions['artDerBetreuung'].find((o) => o.id === doc.artDerBetreuung)
        ?.text || '[Keine Art der Betreuung festgelegt]';
    const range =
      doc.start && doc.end
        ? `${formatTime(doc.start)} – ${formatTime(doc.end)}`
        : doc.start
          ? `ab ${formatTime(doc.start)}`
          : doc.end
            ? `bis ${formatTime(doc.end)}`
            : null;

    return this.render([
      {
        text: `${formatDate(doc.date)}: Familie ${doc.case?.family?.name || '(kein Name)'} `,
        style: 'header',
      },
      { text: `Art der Betreuung: ${art}` },
      ...(range ? [{ text: `Uhrzeit: ${range} Uhr` }] : []),
      { text: `Dauer:  ${doc.duration ?? ''} Minuten` },
      createdByLine(doc.createdBy),
      { text: 'Zusammenfassung', style: 'subheader' },
      { text: doc.zusammenfassung ?? '', style: 'text' },
      { text: 'Themen Allgemein', style: 'subheader' },
      { ul: doc.beratungsThemenAllgemein.map((t) => label('beratungsThemenAllgemein', t)) },
      { text: 'Themen Kinder', style: 'subheader' },
      { ul: doc.beratungsThemenKinder.map((t) => label('beratungsThemenKinder', t)) },
      { text: 'Themen Eltern', style: 'subheader' },
      { ul: doc.beratungsThemenEltern.map((t) => label('beratungsThemenEltern', t)) },
      { text: 'Dokumentation', style: 'subheader' },
      { text: doc.dokumentation ?? '', style: 'text' },
    ]);
  }

  /** The case file ZIP of a (decrypted) case. */
  async caseExportZip(c: FullCase): Promise<Blob> {
    const [{ default: JSZip }, docs, responses] = await Promise.all([
      import('jszip'),
      firstValueFrom(this.documentationService.getDocumentationForCase(c.id)),
      firstValueFrom(this.caseFormService.getCaseFormResponses({ caseId: c.id })),
    ]);
    const zip = new JSZip();
    zip.file(stammdatenFilename(c.family?.name), await this.stammdatenPdf(c));

    const sorted = [...(docs as unknown as FullContactDocumentation[])].sort(
      (a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime(),
    );
    const perDay = new Map<string, number>();
    for (const d of sorted) {
      const day = isoDay(d.date);
      const n = (perDay.get(day) ?? 0) + 1;
      perDay.set(day, n);
      zip.file(
        `Kontaktdokumentationen/${day}_${String(n).padStart(2, '0')}.pdf`,
        await this.contactDocumentationPdf({ ...d, case: d.case ?? c }),
      );
    }

    const byForm = new Map<string, FullCaseFormResponse[]>();
    for (const r of responses)
      if (r.caseFormId) byForm.set(r.caseFormId, [...(byForm.get(r.caseFormId) ?? []), r]);

    const usedNames = new Set<string>();
    for (const [formId, rows] of byForm) {
      const form = await firstValueFrom(this.caseFormService.getCaseForm(formId));
      let name = safeFilename(form.name);
      for (let i = 2; usedNames.has(name); i++) name = `${safeFilename(form.name)}_${i}`;
      usedNames.add(name);
      zip.file(`Fragebögen/${name}.csv`, CSV_BOM + toCsv(rows, this.csvColumns(form)));
    }

    return zip.generateAsync({ type: 'blob' });
  }

  /** The CSV columns of a form: person (for personal forms), one per question, author. */
  private csvColumns(form: FullCaseForm): CsvColumn<FullCaseFormResponse>[] {
    return [
      ...(form.isPersonal
        ? [
            {
              header: 'Person',
              value: (r: FullCaseFormResponse) => {
                const p = r.child ?? r.caregiver;
                return p ? [p.name, p.lastName].filter(Boolean).join(' ') : '';
              },
            },
          ]
        : []),
      ...form.questions.map((q) => ({
        header: q.text,
        value: (r: FullCaseFormResponse) =>
          getAnswerValue(
            r.answers.find((a) => a.questionId === q.id),
            q,
          ),
      })),
      {
        header: 'Erstellt von',
        value: (r) => (r.createdBy ? userName(r.createdBy) : ''),
      },
    ];
  }
}
