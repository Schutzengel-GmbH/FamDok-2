import { EnsureDate } from './ensureDate.pipe';

describe('EnsureDate', () => {
  const pipe = new EnsureDate();

  it('converts a date string into a Date instance', () => {
    const result = pipe.transform('2026-03-15');

    expect(result).toEqual(new Date('2026-03-15'));
  });

  it('passes a Date instance through as a Date', () => {
    const date = new Date('2026-03-15');

    expect(pipe.transform(date)).toEqual(date);
  });

  it('returns undefined for falsy values', () => {
    expect(pipe.transform(undefined)).toBeUndefined();
    expect(pipe.transform('')).toBeUndefined();
  });
});
