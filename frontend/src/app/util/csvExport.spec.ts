import { csvFilename, downloadCsv, toCsv } from './csvExport';

describe('csvExport', () => {
  describe('toCsv', () => {
    it('builds a header row and one row per item, semicolon-delimited', () => {
      const rows = [
        { name: 'Anna', age: 30 },
        { name: 'Max', age: 5 },
      ];
      const csv = toCsv(rows, [
        { header: 'Name', value: (r) => r.name },
        { header: 'Alter', value: (r) => r.age },
      ]);

      expect(csv).toBe('Name;Alter\r\nAnna;30\r\nMax;5');
    });

    it('renders null/undefined values as an empty cell', () => {
      const csv = toCsv([{ v: null }], [{ header: 'V', value: (r) => r.v }]);

      expect(csv).toBe('V\r\n');
    });

    it('quotes and escapes values containing the delimiter, quotes, or newlines', () => {
      const csv = toCsv(
        [{ v: 'a;b' }, { v: 'say "hi"' }, { v: 'line1\nline2' }],
        [{ header: 'V', value: (r) => r.v }],
      );

      expect(csv).toBe('V\r\n"a;b"\r\n"say ""hi"""\r\n"line1\nline2"');
    });
  });

  describe('csvFilename', () => {
    it("appends today's date to the base filename", () => {
      const today = new Date().toISOString().slice(0, 10);

      expect(csvFilename('Export')).toBe(`Export_${today}.csv`);
    });
  });

  describe('downloadCsv', () => {
    it('creates an object URL and triggers a download via a temporary anchor', () => {
      const createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:mock-url');
      const revokeObjectURLSpy = spyOn(URL, 'revokeObjectURL');
      const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

      downloadCsv('export.csv', 'a;b\r\n1;2');

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});
