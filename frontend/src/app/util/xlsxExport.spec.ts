import { downloadXlsx, toXlsxBlob, xlsxFilename } from './xlsxExport';

describe('xlsxExport', () => {
  describe('toXlsxBlob', () => {
    it('builds a valid, non-empty xlsx blob from rows and columns', async () => {
      const rows = [
        { name: 'Anna', age: 30 },
        { name: 'Max', age: 5 },
      ];

      const blob = await toXlsxBlob(rows, [
        { header: 'Name', value: (r) => r.name },
        { header: 'Alter', value: (r) => r.age, type: Number },
      ]);

      expect(blob.type).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(blob.size).toBeGreaterThan(0);
    });

    it('defaults a format for Date-typed columns (write-excel-file requires one)', async () => {
      const blob = await toXlsxBlob([{ when: new Date('2026-01-15') }], [
        { header: 'Datum', value: (r) => r.when, type: Date },
      ]);

      expect(blob.size).toBeGreaterThan(0);
    });

    it('builds a blob for an empty row set', async () => {
      const blob = await toXlsxBlob<{ v: string }>([], [
        { header: 'V', value: (r) => r.v },
      ]);

      expect(blob.size).toBeGreaterThan(0);
    });
  });

  describe('xlsxFilename', () => {
    it("appends today's date to the base filename", () => {
      const today = new Date().toISOString().slice(0, 10);

      expect(xlsxFilename('Export')).toBe(`Export_${today}.xlsx`);
    });
  });

  describe('downloadXlsx', () => {
    it('creates an object URL and triggers a download via a temporary anchor', () => {
      const createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:mock-url');
      const revokeObjectURLSpy = spyOn(URL, 'revokeObjectURL');
      const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

      downloadXlsx('export.xlsx', new Blob(['x']));

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});
