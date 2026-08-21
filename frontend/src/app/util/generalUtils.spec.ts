import {
  isEmptyObject,
  sortByNumProperty,
  sortByStringProperty,
  unique,
} from './generalUtils';

describe('generalUtils', () => {
  describe('sortByNumProperty', () => {
    it('sorts ascending by the given numeric property', () => {
      const items = [{ n: 3 }, { n: 1 }, { n: 2 }];

      expect(items.sort(sortByNumProperty('n'))).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    });
  });

  describe('sortByStringProperty', () => {
    it('sorts ascending by the given string property', () => {
      const items = [{ s: 'c' }, { s: 'a' }, { s: 'b' }];

      expect(items.sort(sortByStringProperty('s'))).toEqual([
        { s: 'a' },
        { s: 'b' },
        { s: 'c' },
      ]);
    });
  });

  describe('isEmptyObject', () => {
    it('returns true for an empty object', () => {
      expect(isEmptyObject({})).toBeTrue();
    });

    it('returns false for a non-empty object', () => {
      expect(isEmptyObject({ a: 1 })).toBeFalse();
    });

    it('returns false for non-object primitive values', () => {
      expect(isEmptyObject('string')).toBeFalse();
      expect(isEmptyObject(42)).toBeFalse();
    });

    it('treats null as empty, since typeof null is "object" and for-in over null never iterates', () => {
      expect(isEmptyObject(null)).toBeTrue();
    });
  });

  describe('unique', () => {
    it('filters an array down to unique values', () => {
      expect([1, 2, 2, 3, 1].filter(unique)).toEqual([1, 2, 3]);
    });
  });
});
