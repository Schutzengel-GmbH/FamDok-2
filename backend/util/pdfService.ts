import {
  Content,
  StyleDictionary,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import pdfMake from 'pdfmake';
import {
  FullCase,
  FullContactDocumentation,
  FullUser,
} from '../../shared/types';
import { ContactDocumentationOptions } from '../../shared/sharedGlobals';
import {
  Organisation,
  SubOrganisation,
} from '../../shared/generated/prisma/client';
import {
  FAMILIENSTAND_LABELS,
  GENDER_LABELS,
  RELATION_LABELS,
} from '../../shared/utils/labels';

export type StammdatenCase = FullCase & {
  organisation: Organisation;
  subOrganisation: SubOrganisation | null;
};

const NO_VALUE = 'Keine Angabe';

export class PDFService {
  static fonts = {
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  };

  static styles: StyleDictionary = {
    header: {
      fontSize: 18,
      bold: true,
      marginTop: 24,
      marginBottom: 6,
    },
    subheader: {
      fontSize: 15,
      bold: true,
      marginTop: 12,
      marginBottom: 6,
    },
    text: {
      fontSize: 11,
      marginBottom: 6,
    },
    quote: {
      italics: true,
    },
    small: {
      fontSize: 8,
    },
  };

  /** DD.MM.YYYY in German local time, independent of the server's timezone. */
  static formatDate(d: Date | string | null | undefined): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /** HH:MM in German local time, independent of the server's timezone. */
  static formatTime(d: Date | string): string {
    return new Date(d).toLocaleTimeString('de-DE', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** "Uhrzeit: 10:00 – 11:30 Uhr" (or just the known side), nothing if neither is set. */
  private static timeRangeLine(
    start: Date | null | undefined,
    end: Date | null | undefined
  ): Content[] {
    if (!start && !end) return [];
    const range =
      start && end
        ? `${this.formatTime(start)} – ${this.formatTime(end)}`
        : start
          ? `ab ${this.formatTime(start)}`
          : `bis ${this.formatTime(end!)}`;
    return [{ text: `Uhrzeit: ${range} Uhr` }];
  }

  /** "Erstellt von: Vorname Nachname (Org – SubOrg)", matching the frontend's userWithOrgPipe. */
  static createdByLine(user: FullUser | null | undefined): Content {
    if (!user) return { text: 'Erstellt von: (unbekannt)' };

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    const subOrgNames = user.subOrganisations?.map((so) => so.name).join(', ');
    const orgLabel = [user.organisation?.name, subOrgNames]
      .filter(Boolean)
      .join(' – ');

    return {
      text: `Erstellt von: ${orgLabel ? `${name} (${orgLabel})` : name}`,
    };
  }

  private static render(content: Content[]) {
    pdfMake.addFonts(this.fonts);
    return pdfMake
      .createPdf({
        content,
        styles: this.styles,
        defaultStyle: {
          font: 'Helvetica',
        },
      })
      .getBuffer();
  }

  private static yesNo(value: boolean | null | undefined): string {
    if (value === null || value === undefined) return NO_VALUE;
    return value ? 'Ja' : 'Nein';
  }

  private static row(label: string, value: string | null | undefined) {
    return [{ text: label, bold: true }, { text: value || NO_VALUE }];
  }

  private static keyValueTable(rows: ReturnType<typeof PDFService.row>[]) {
    return {
      table: { widths: [180, '*'], body: rows },
      layout: 'noBorders',
      marginBottom: 6,
    } satisfies Content;
  }

  private static personTable(headers: string[], rows: string[][]): Content {
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

  static async stammdatenPDF(c: StammdatenCase) {
    const family = c.family;
    const address = family?.adress;
    const addressString = address
      ? `${address.street} ${address.number}, ${address.plz} ${address.city}`
      : null;

    const migration =
      c.migrationBackground && c.specificMigrationBackground
        ? `Ja, ${c.specificMigrationBackground}`
        : this.yesNo(c.migrationBackground);

    const responsible = c.responsibleUsers
      .map((u) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email)
      .join(', ');

    const caregivers = (family?.caregiver ?? []).map((cg) => [
      [cg.name, cg.lastName].filter(Boolean).join(' '),
      RELATION_LABELS[cg.relation],
      GENDER_LABELS[cg.gender],
      this.formatDate(cg.dateOfBirth),
    ]);

    const children = (family?.children ?? []).map((ch) => [
      [ch.name, ch.lastName].filter(Boolean).join(' '),
      GENDER_LABELS[ch.gender],
      this.formatDate(ch.dateOfBirth),
    ]);

    return this.render([
      {
        text: `Stammdaten Familie ${family?.name || '(kein Name)'}`,
        style: 'header',
      },
      { text: 'Fall', style: 'subheader' },
      this.keyValueTable([
        this.row('Beginn', this.formatDate(c.startedAt)),
        ...(c.closedAt
          ? [this.row('Abschluss', this.formatDate(c.closedAt))]
          : []),
        this.row(
          'Organisation',
          [c.organisation?.name, c.subOrganisation?.name]
            .filter(Boolean)
            .join(' – ')
        ),
        this.row('Ort', [c.plz, c.city].filter(Boolean).join(' ')),
        this.row(
          'Familienstand',
          c.familienstand ? FAMILIENSTAND_LABELS[c.familienstand] : null
        ),
        this.row('Migrationshintergrund', migration),
        this.row('Beide Elternteile involviert', this.yesNo(c.partnerInvolved)),
        this.row('Beim Jugendamt bekannt', this.yesNo(c.bekanntJA)),
        this.row('Verantwortlich', responsible),
      ]),
      { text: 'Familie', style: 'subheader' },
      this.keyValueTable([
        this.row('Adresse', addressString),
        this.row('Telefon', family?.phone),
        this.row(
          'Weitere Telefonnummern',
          family?.additionalPhones?.join(', ')
        ),
        this.row('Notiz', family?.note),
      ]),
      { text: 'Bezugspersonen', style: 'subheader' },
      this.personTable(
        ['Name', 'Beziehung', 'Geschlecht', 'Geburtsdatum'],
        caregivers
      ),
      { text: 'Kinder', style: 'subheader' },
      this.personTable(['Name', 'Geschlecht', 'Geburtsdatum'], children),
    ]);
  }

  static async contactDocumentationPDF(doc: FullContactDocumentation) {
    // prepare strings
    const art =
      ContactDocumentationOptions['artDerBetreuung'].find(
        (o) => o.id === doc.artDerBetreuung
      )?.text || '[Keine Art der Betreuung festgelegt]';

    const themenAllgemein = doc.beratungsThemenAllgemein.map(
      (t) =>
        ContactDocumentationOptions['beratungsThemenAllgemein'].find(
          (o) => o.id === t
        )?.text || ''
    );

    const themenKinder = doc.beratungsThemenKinder.map(
      (t) =>
        ContactDocumentationOptions['beratungsThemenKinder'].find(
          (o) => o.id === t
        )?.text || ''
    );

    const themenEltern = doc.beratungsThemenEltern.map(
      (t) =>
        ContactDocumentationOptions['beratungsThemenEltern'].find(
          (o) => o.id === t
        )?.text || ''
    );

    const date = this.formatDate(doc.date);

    return this.render([
      {
        text: `${date}: Familie ${doc.case.family?.name || '(kein Name)'} `,
        style: 'header',
      },
      { text: `Art der Betreuung: ${art}` },
      ...this.timeRangeLine(doc.start, doc.end),
      { text: `Dauer:  ${doc.duration} Minuten` },
      this.createdByLine(doc.createdBy),
      { text: 'Zusammenfassung', style: 'subheader' },
      { text: doc.zusammenfassung ?? '', style: 'text' },
      {
        text: 'Themen Allgemein',
        style: 'subheader',
      },
      { ul: themenAllgemein },
      {
        text: 'Themen Kinder',
        style: 'subheader',
      },
      { ul: themenKinder },
      {
        text: 'Themen Eltern',
        style: 'subheader',
      },
      { ul: themenEltern },
      { text: 'Dokumentation', style: 'subheader' },
      { text: doc.dokumentation ?? '', style: 'text' },
    ]);
  }
}
