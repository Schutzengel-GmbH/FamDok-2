import { TruncatePipe } from './truncate.pipe';

describe('TruncatePipe', () => {
  const pipe = new TruncatePipe();

  it('returns the value unchanged when shorter than the max length', () => {
    expect(pipe.transform('hi', 10)).toBe('hi');
  });

  it('truncates and appends an ellipsis when longer than the max length', () => {
    expect(pipe.transform('hello world', 5)).toBe('hello...');
  });

  it('defaults to a max length of 3 when none is given', () => {
    expect(pipe.transform('hello')).toBe('hel...');
  });

  it('returns the value unchanged when exactly at the max length', () => {
    expect(pipe.transform('abc', 3)).toBe('abc');
  });
});
