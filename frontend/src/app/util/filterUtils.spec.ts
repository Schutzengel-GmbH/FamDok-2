import {
  combineWhereFilters,
  makeCaseFilter,
  makeDateQuestionFilter,
  makeNumberQuestionFilter,
  makeTextQuestionFilter,
} from './filterUtils';
import { buildQuestion } from 'src/app/testing/fixtures';

describe('filterUtils', () => {
  describe('makeCaseFilter', () => {
    it('builds simple string filters for name/city/plz', () => {
      const result = makeCaseFilter({
        name: { filter: 'contains', value: 'Muster' },
        city: { filter: 'equals', value: 'Berlin' },
        plz: { filter: 'equals', value: '12345' },
      });

      expect(result.family).toEqual({ name: { contains: 'Muster' } });
      expect(result.city).toEqual({ equals: 'Berlin' });
      expect(result.plz).toEqual({ equals: '12345' });
    });

    it('leaves fields undefined when not filtered', () => {
      const result = makeCaseFilter({});

      expect(result.city).toBeUndefined();
      expect(result.zielvereinbarungen).toBeUndefined();
    });

    it('builds a gte/lte range for a "range" closedAt filter', () => {
      const from = new Date('2026-01-01');
      const to = new Date('2026-02-01');
      const result = makeCaseFilter({ closedAt: { filter: 'range', value: [from, to] } });

      expect(result.closedAt).toEqual({ gte: from, lte: to });
    });

    it('builds a plain comparison for a non-range startedAt filter', () => {
      const date = new Date('2026-01-01');
      const result = makeCaseFilter({ startedAt: { filter: 'gte', value: date } });

      expect(result.startedAt).toEqual({ gte: date });
    });

    it('only includes zielvereinbarungen when at least one ziel field is set', () => {
      const result = makeCaseFilter({ zielTopic: 'Wohnen' });

      expect(result.zielvereinbarungen).toEqual({
        some: {
          startedAt: undefined,
          finishBy: undefined,
          status: undefined,
          topic: 'Wohnen',
        },
      });
    });

    it('builds a range filter for zielFinishBy', () => {
      const from = new Date('2026-01-01');
      const to = new Date('2026-03-01');
      const result = makeCaseFilter({ zielFinishBy: { filter: 'range', value: [from, to] } });

      expect((result.zielvereinbarungen as any).some.finishBy).toEqual({ gte: from, lte: to });
    });
  });

  describe('makeTextQuestionFilter', () => {
    it('builds a case-insensitive contains filter on the question', () => {
      const question = buildQuestion();

      const result = makeTextQuestionFilter({ question, value: 'hallo' });

      expect(result).toEqual({
        questionId: question.id,
        answerText: { contains: 'hallo', mode: 'insensitive' },
      });
    });
  });

  describe('makeNumberQuestionFilter', () => {
    it('filters on answerNum for a Float question', () => {
      const question = buildQuestion({ type: 'Float' });

      const result = makeNumberQuestionFilter({
        question,
        filter: { filter: 'gte', value: 3 },
      });

      expect(result).toEqual({ questionId: question.id, answerNum: { gte: 3 } });
    });

    it('filters on answerInt for an Integer question', () => {
      const question = buildQuestion({ type: 'Integer' });

      const result = makeNumberQuestionFilter({
        question,
        filter: { filter: 'lt', value: 10 },
      });

      expect(result).toEqual({ questionId: question.id, answerInt: { lt: 10 } });
    });

    it('returns an empty filter for any other question type', () => {
      const question = buildQuestion({ type: 'Text' });

      const result = makeNumberQuestionFilter({
        question,
        filter: { filter: 'equals', value: 1 },
      });

      expect(result).toEqual({});
    });
  });

  describe('combineWhereFilters', () => {
    it('returns undefined when no filter is given', () => {
      expect(combineWhereFilters()).toBeUndefined();
    });

    it('returns undefined when every filter is undefined or empty', () => {
      expect(combineWhereFilters(undefined, {}, undefined)).toBeUndefined();
    });

    it('returns the single filter unwrapped when only one is non-empty', () => {
      const filter = { organisationId: 'org-1' };

      expect(combineWhereFilters<any>(undefined, filter, {})).toBe(filter);
    });

    it('ANDs multiple non-empty filters together instead of one overwriting the other', () => {
      const a = { id: 'user-1' };
      const b = { organisationId: 'org-1' };

      expect(combineWhereFilters<any>(a, b)).toEqual({ AND: [a, b] });
    });
  });

  describe('makeDateQuestionFilter', () => {
    it('builds a filter on answerDate', () => {
      const question = buildQuestion();
      const date = new Date('2026-01-01');

      const result = makeDateQuestionFilter({ question, filter: { filter: 'equals', value: date } });

      expect(result).toEqual({ questionId: question.id, answerDate: { equals: date } });
    });
  });
});
