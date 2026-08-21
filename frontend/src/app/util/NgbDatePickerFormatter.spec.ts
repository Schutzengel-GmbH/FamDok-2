import { NgbDateDeParserFormatter } from './NgbDatePickerFormatter';

describe('NgbDateDeParserFormatter', () => {
  const formatter = new NgbDateDeParserFormatter();

  describe('parse', () => {
    it('parses a German-formatted date string', () => {
      expect(formatter.parse('15.03.2026')).toEqual({ day: 15, month: 3, year: 2026 });
    });

    it('returns null for a malformed string', () => {
      expect(formatter.parse('2026-03-15')).toBeNull();
      expect(formatter.parse('')).toBeNull();
    });
  });

  describe('format', () => {
    it('formats a date struct as a German date string', () => {
      expect(formatter.format({ day: 15, month: 3, year: 2026 })).toBe('15.3.2026');
    });

    it('returns an empty string for null', () => {
      expect(formatter.format(null)).toBe('');
    });
  });
});
