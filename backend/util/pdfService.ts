import { StyleDictionary, TDocumentDefinitions } from 'pdfmake/interfaces';
import pdfMake from 'pdfmake';

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

  // `doc` isn't used yet - content generation is still a stub - so it's typed to only what's
  // guaranteed regardless of caller/role, rather than the full ContactDocumentation shape.
  static async contactDocumentationPDF(doc: { id: string }) {
    pdfMake.addFonts(this.fonts);
    return pdfMake
      .createPdf({
        content: [
          //TODO: rework the PDF content from the new answers
        ],
        styles: this.styles,
        defaultStyle: {
          font: 'Helvetica',
        },
      })
      .getBuffer();
  }
}
