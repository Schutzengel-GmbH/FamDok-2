import { FamilienstandPipe } from './familienstand.pipe';

describe('FamilienstandPipe', () => {
  const pipe = new FamilienstandPipe();

  it('translates each known value to German', () => {
    expect(pipe.transform('ledig' as any)).toBe('Ledig');
    expect(pipe.transform('verheiratet' as any)).toBe('Verheiratet');
    expect(pipe.transform('geschieden' as any)).toBe('Geschieden');
    expect(pipe.transform('unspecified' as any)).toBe('Keine Angabe');
  });

  it('returns undefined for an unrecognized value', () => {
    expect(pipe.transform('unknown' as any)).toBeUndefined();
  });
});
