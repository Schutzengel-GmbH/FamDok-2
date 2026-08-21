/** Serializes `rows` as a pretty-printed JSON array. */
export function toJson<T>(rows: T[]): string {
  return JSON.stringify(rows, null, 2);
}

/** Triggers a browser download of `json` as a UTF-8 JSON file. */
export function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Appends today's date to a base filename, e.g. "Kontaktdokumentationen" -> "Kontaktdokumentationen_2026-08-07.json". */
export function jsonFilename(base: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${base}_${date}.json`;
}
