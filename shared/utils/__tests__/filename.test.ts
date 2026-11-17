import {
  caseExportFilename,
  safeFilename,
  stammdatenFilename,
} from "../filename";

describe("safeFilename", () => {
  it("strips characters that are invalid in file names", () => {
    expect(safeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe("abcdefghij");
  });

  it("keeps umlauts", () => {
    expect(safeFilename("Müller-Größe")).toBe("Müller-Größe");
  });

  it.each([null, undefined, "", "   ", "///"])(
    "falls back to 'unbekannt' for %p",
    (input) => {
      expect(safeFilename(input)).toBe("unbekannt");
    },
  );
});

describe("export filenames", () => {
  it("builds the Stammdaten PDF name", () => {
    expect(stammdatenFilename("Meier")).toBe("Stammdaten-Familie-Meier.pdf");
  });

  it("builds the case export ZIP name", () => {
    expect(caseExportFilename(null)).toBe("Fallakte-Familie-unbekannt.zip");
  });
});
