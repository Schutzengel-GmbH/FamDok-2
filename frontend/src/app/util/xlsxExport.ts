import writeXlsxFile from 'write-excel-file/browser';
import { triggerBlobDownload } from 'src/app/services/document.service';

export interface XlsxColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | Date | null | undefined;
  type?: typeof String | typeof Number | typeof Boolean | typeof Date;
  /** Excel number/date format string. Defaults to `dd.mm.yyyy` for `type: Date` columns. */
  format?: string;
  width?: number;
}

const DEFAULT_DATE_FORMAT = 'dd.mm.yyyy';

/** Builds an .xlsx file (single sheet, bold header row) from `rows` using `columns`. */
export async function toXlsxBlob<T>(
  rows: T[],
  columns: XlsxColumn<T>[],
): Promise<Blob> {
  const schema = columns.map((column) => ({
    header: { value: column.header, fontWeight: 'bold' as const },
    cell: (row: T) => ({
      value: column.value(row) ?? undefined,
      type: column.type,
      format:
        column.format ?? (column.type === Date ? DEFAULT_DATE_FORMAT : undefined),
    }),
    width: column.width,
  }));
  return writeXlsxFile(rows, { columns: schema }).toBlob();
}

/** Triggers a browser download of `blob` as an .xlsx file. */
export function downloadXlsx(filename: string, blob: Blob): void {
  triggerBlobDownload(filename, blob);
}

/** Appends today's date to a base filename, e.g. "Kontaktdokumentationen" -> "Kontaktdokumentationen_2026-08-19.xlsx". */
export function xlsxFilename(base: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${base}_${date}.xlsx`;
}
