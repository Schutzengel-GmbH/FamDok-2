import { StyleDictionary, TDocumentDefinitions } from 'pdfmake/interfaces';
import pdfMake from 'pdfmake';
import { FullContactDocumentation } from '../../shared/types';
import { ContactDocumentationOptions } from '../../shared/sharedGlobals';

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

    const date = doc.date?.toLocaleDateString();

    pdfMake.addFonts(this.fonts);
    return pdfMake
      .createPdf({
        content: [
          {
            text: `${date}: Familie ${doc.case.family?.name || '(kein Name)'} `,
            style: 'header',
          },
          { text: `Art der Betreuung: ${art}` },
          { text: `Dauer:  ${doc.duration} Minuten` },
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
        ],
        styles: this.styles,
        defaultStyle: {
          font: 'Helvetica',
        },
      })
      .getBuffer();
  }
}
