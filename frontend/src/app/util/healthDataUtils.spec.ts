import {
  ageInMonths,
  ageString,
  getPercentileDatasets,
  getWeightForMonth,
  gramsToKg,
  kgToGrams,
} from './healthDataUtils';
import { Gender } from '../../../../shared/generated/prisma/enums';

describe('healthDataUtils', () => {
  describe('kgToGrams / gramsToKg', () => {
    it('converts kg to the nearest gram', () => {
      expect(kgToGrams(3.52)).toBe(3520);
      // classic floating-point case (3.52 * 1000 === 3519.9999999999995) - must round, not floor
      expect(kgToGrams(3.523)).toBe(3523);
    });

    it('converts grams back to kg', () => {
      expect(gramsToKg(3520)).toBe(3.52);
    });

    it('round-trips a gram-precision value', () => {
      expect(kgToGrams(gramsToKg(3520))).toBe(3520);
    });
  });

  describe('getPercentileDatasets', () => {
    it('returns 5 percentile datasets, each covering months 0 to 12', () => {
      const datasets = getPercentileDatasets(Gender.male, 0);

      expect(datasets.length).toBe(5);
      expect(datasets.map((d) => d.label)).toEqual([
        '97%',
        '85%',
        '50%',
        '15%',
        '3%',
      ]);
      datasets.forEach((d) => expect(d.data.length).toBe(13));
    });

    it('uses different data for male vs. other genders', () => {
      const male = getPercentileDatasets(Gender.male, 0);
      const other = getPercentileDatasets(Gender.female, 0);

      expect(male[0].data).not.toEqual(other[0].data);
    });

    it('slices the correct 12-month window for the given ageRange', () => {
      const range0 = getPercentileDatasets(Gender.male, 0)[0]
        .data as number[];
      const range1 = getPercentileDatasets(Gender.male, 1)[0]
        .data as number[];

      expect(range0).not.toEqual(range1);
    });

    it('uses the age in months as x value', () => {
      const range1 = getPercentileDatasets(Gender.male, 1)[0].data as {
        x: number;
      }[];

      expect(range1.map((p) => p.x)).toEqual(
        [...Array(13).keys()].map((n) => n + 12),
      );
    });

    it('covers months 24 to 36 for the last age range, for both metrics', () => {
      for (const metric of ['weight', 'height'] as const) {
        const range2 = getPercentileDatasets(Gender.female, 2, metric)[0]
          .data as { x: number }[];
        expect(range2.length).toBe(13);
        expect(range2.at(-1)!.x).toBe(36);
      }
    });
  });

  describe('ageInMonths', () => {
    it('is 0 on the birthday', () => {
      const birthday = new Date('2024-01-15');
      expect(ageInMonths(birthday, birthday)).toBe(0);
    });

    it('is about 1 one month after the birthday', () => {
      expect(
        ageInMonths(new Date('2024-01-15'), new Date('2024-02-15')),
      ).toBeCloseTo(1, 0);
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
