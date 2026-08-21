export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

const DELIMITER = ';';
const NEEDS_QUOTING = new RegExp(`["${DELIMITER}\r\n]`);

function escapeCsvValue(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return NEEDS_QUOTING.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Builds a CSV string (CRLF line endings, RFC 4126-style quoting, `;`-delimited) from `rows` using `columns`. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [
    columns.map((c) => escapeCsvValue(c.header)).join(DELIMITER),
    ...rows.map((row) =>
      columns.map((c) => escapeCsvValue(c.value(row))).join(DELIMITER),
    ),
  ];
  return lines.join('\r\n');
}

/**
 * Triggers a browser download of `csv` as a UTF-8 file. Includes a BOM so umlauts render
 * correctly when the file is opened in Excel.
 */
export function downloadCsv(filename: string, csv: string): void {
  const bom = '﻿';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
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
