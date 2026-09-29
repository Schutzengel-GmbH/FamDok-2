import { CSV_BOM } from '../../../../shared/utils/csv';

export { toCsv } from '../../../../shared/utils/csv';
export type { CsvColumn } from '../../../../shared/utils/csv';

/**
 * Triggers a browser download of `csv` as a UTF-8 file. Includes a BOM so umlauts render
 * correctly when the file is opened in Excel.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([CSV_BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Appends today's date to a base filename, e.g. "Kontaktdokumentationen" -> "Kontaktdokumentationen_2026-08-07.csv". */
export function csvFilename(base: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${base}_${date}.csv`;
}
