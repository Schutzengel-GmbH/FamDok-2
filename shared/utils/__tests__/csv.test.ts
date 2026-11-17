import { CsvColumn, toCsv } from "../csv";

interface Row {
  name: string;
  count: number | null;
}

const columns: CsvColumn<Row>[] = [
  { header: "Name", value: (r) => r.name },
  { header: "Anzahl", value: (r) => r.count },
];

describe("toCsv", () => {
  it("joins header and rows with ';' and CRLF", () => {
    expect(toCsv([{ name: "A", count: 1 }], columns)).toBe("Name;Anzahl\r\nA;1");
  });

  it("renders null/undefined as empty cells", () => {
    expect(toCsv([{ name: "A", count: null }], columns)).toBe("Name;Anzahl\r\nA;");
  });

  it("quotes values containing the delimiter, quotes or newlines", () => {
    const csv = toCsv(
      [
        { name: "a;b", count: 0 },
        { name: 'say "hi"', count: 0 },
        { name: "line\nbreak", count: 0 },
      ],
      columns,
    );
    expect(csv.split("\r\n").slice(1)).toEqual([
      '"a;b";0',
      '"say ""hi""";0',
      '"line\nbreak";0',
    ]);
  });

  it("outputs only the header for no rows", () => {
    expect(toCsv([], columns)).toBe("Name;Anzahl");
  });
});
