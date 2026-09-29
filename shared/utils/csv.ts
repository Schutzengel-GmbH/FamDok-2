export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

const DELIMITER = ";";
const NEEDS_QUOTING = new RegExp(`["${DELIMITER}\r\n]`);

/** UTF-8 byte order mark - prepended to CSV files so umlauts render correctly in Excel. */
export const CSV_BOM = "﻿";

function escapeCsvValue(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
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
  return lines.join("\r\n");
}
