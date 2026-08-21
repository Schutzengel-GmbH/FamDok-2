import * as z from 'zod';
import { safeParseJson, validateAnswer } from './validation';
import { buildAnswer, buildQuestion } from 'src/app/testing/fixtures';

describe('validation', () => {
  describe('safeParseJson', () => {
    const schema = z.object({ name: z.string() });

    it('returns success with the parsed data when JSON and schema both pass', () => {
      const result = safeParseJson(schema, '{"name":"Intake"}');

      expect(result.success).toBeTrue();
      expect((result as any).data).toEqual({ name: 'Intake' });
    });

    it('returns failure when the JSON is malformed', () => {
      const result = safeParseJson(schema, 'not json');

      expect(result.success).toBeFalse();
      expect((result as any).error).toBeDefined();
    });

    it('returns failure when JSON parses but fails schema validation', () => {
      const result = safeParseJson(schema, '{"name": 5}');

      expect(result.success).toBeFalse();
    });
  });

  describe('validateAnswer', () => {
    it('fails a required question with no answer', () => {
      expect(validateAnswer(buildQuestion({ required: true }))).toBeFalse();
    });

    it('fails a required question with an empty answer', () => {
      const question = buildQuestion({ required: true });
      const answer = buildAnswer();

      expect(validateAnswer(question, answer as any)).toBeFalse();
    });

    it('passes an optional question with no answer', () => {
      expect(validateAnswer(buildQuestion({ required: false }))).toBeTrue();
    });

    it('passes a required question with a text answer', () => {
      const question = buildQuestion({ required: true, type: 'Text' });
      const answer = buildAnswer({ answerText: 'hi' });

      expect(validateAnswer(question, answer as any)).toBeTrue();
    });

    it('fails an Integer answer above max', () => {
      const question = buildQuestion({ type: 'Integer', max: 10 });
      const answer = buildAnswer({ answerInt: 20 });

      expect(validateAnswer(question, answer as any)).toBeFalse();
    });

    it('fails an Integer answer below min', () => {
      const question = buildQuestion({ type: 'Integer', min: 5 });
      const answer = buildAnswer({ answerInt: 1 });

      expect(validateAnswer(question, answer as any)).toBeFalse();
    });

    it('fails a Float answer above max', () => {
      const question = buildQuestion({ type: 'Float', max: 1.5 });
      const answer = buildAnswer({ answerNum: 2 });

      expect(validateAnswer(question, answer as any)).toBeFalse();
    });

    it('passes an Integer answer within range', () => {
      const question = buildQuestion({ type: 'Integer', min: 0, max: 10 });
      const answer = buildAnswer({ answerInt: 5 });

      expect(validateAnswer(question, answer as any)).toBeTrue();
    });
  });
});
