import { ageString, getPercentileDatasets, getWeightForMonth } from './healthDataUtils';
import { Gender } from '../../../../shared/generated/prisma/enums';

describe('healthDataUtils', () => {
  describe('getPercentileDatasets', () => {
    it('returns 5 percentile datasets, each with 12 months of data', () => {
      const datasets = getPercentileDatasets(Gender.male, 0);

      expect(datasets.length).toBe(5);
      expect(datasets.map((d) => d.label)).toEqual(['97%', '85%', '50%', '15%', '3%']);
      datasets.forEach((d) => expect((d.data as number[]).length).toBe(12));
    });

    it('uses different data for male vs. other genders', () => {
      const male = getPercentileDatasets(Gender.male, 0);
      const other = getPercentileDatasets(Gender.female, 0);

      expect(male[0].data).not.toEqual(other[0].data);
    });

    it('slices the correct 12-month window for the given ageRange', () => {
      const range0 = getPercentileDatasets(Gender.male, 0)[0].data as number[];
      const range1 = getPercentileDatasets(Gender.male, 1)[0].data as number[];

      expect(range0).not.toEqual(range1);
    });
  });

  describe('getWeightForMonth', () => {
    const birthday = new Date('2024-01-15');

    it('returns null when there is no data point for that month', () => {
      expect(getWeightForMonth([], birthday, 3)).toBeNull();
    });

    it('returns the weight when exactly one data point falls in that month', () => {
      const healthData = [{ date: new Date('2024-04-10'), weightKg: 6.5 }];

      expect(getWeightForMonth(healthData, birthday, 3)).toBe(6.5);
    });

    it('averages the weight when multiple data points fall in the same month', () => {
      const healthData = [
        { date: new Date('2024-04-05'), weightKg: 6 },
        { date: new Date('2024-04-20'), weightKg: 7 },
      ];

      expect(getWeightForMonth(healthData, birthday, 3)).toBe(6.5);
    });
  });

  describe('ageString', () => {
    it('reports age in months for children under 3', () => {
      const child = { dateOfBirth: new Date('2025-06-01') } as any;

      expect(ageString(child, new Date('2026-01-01'))).toBe('6 Monate');
    });

    it('reports age in years for children 3 and older', () => {
      const child = { dateOfBirth: new Date('2020-01-01') } as any;

      expect(ageString(child, new Date('2026-01-01'))).toBe('6 Jahre');
    });
  });
});
