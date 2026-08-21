import { downloadJson, jsonFilename, toJson } from './jsonExport';

describe('jsonExport', () => {
  describe('toJson', () => {
    it('serializes rows as a pretty-printed JSON array', () => {
      const rows = [
        { name: 'Anna', age: 30 },
        { name: 'Max', age: 5 },
      ];

      expect(toJson(rows)).toBe(JSON.stringify(rows, null, 2));
    });

    it('serializes an empty array', () => {
      expect(toJson([])).toBe('[]');
    });
  });

  describe('jsonFilename', () => {
    it("appends today's date to the base filename", () => {
      const today = new Date().toISOString().slice(0, 10);

      expect(jsonFilename('Export')).toBe(`Export_${today}.json`);
    });
  });

  describe('downloadJson', () => {
    it('creates an object URL and triggers a download via a temporary anchor', () => {
      const createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:mock-url');
      const revokeObjectURLSpy = spyOn(URL, 'revokeObjectURL');
      const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

      downloadJson('export.json', '[{"a":1}]');

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});
