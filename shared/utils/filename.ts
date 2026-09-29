/** Strips characters that aren't allowed in file names (keeps umlauts), falls back to "unbekannt". */
export function safeFilename(s: string | null | undefined): string {
  const cleaned = (s ?? "").replace(/[\\/:*?"<>|\x00-\x1f]/g, "").trim();
  return cleaned || "unbekannt";
}

export function stammdatenFilename(familyName: string | null | undefined) {
  return `Stammdaten-Familie-${safeFilename(familyName)}.pdf`;
}

export function caseExportFilename(familyName: string | null | undefined) {
  return `Fallakte-Familie-${safeFilename(familyName)}.zip`;
}
