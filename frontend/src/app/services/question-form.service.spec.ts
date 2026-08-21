import { TestBed } from '@angular/core/testing';

import { QuestionFormService } from './question-form.service';
import { buildQuestion } from 'src/app/testing/fixtures';
import { QuestionType } from '../../../../shared/generated/prisma/enums';

describe('QuestionFormService', () => {
  let service: QuestionFormService;

  beforeEach(() => {
    service = TestBed.inject(QuestionFormService);
  });

  describe('createQuestionsArray / buildQuestionGroup', () => {
    it('creates an empty array when no questions are given', () => {
      expect(service.createQuestionsArray().length).toBe(0);
    });

    it('populates one group per existing question', () => {
      const array = service.createQuestionsArray([
        buildQuestion({ text: 'Q1' }) as any,
        buildQuestion({ text: 'Q2' }) as any,
      ]);

      expect(array.length).toBe(2);
      expect(array.at(0).get('text')!.value).toBe('Q1');
    });

    it('defaults a new question group to a required-text-empty Text question', () => {
      const group = service.buildQuestionGroup();

      expect(group.value.type).toBe(QuestionType.Text);
      expect(group.value.textAreaRows).toBe(3);
      expect(group.valid).toBeFalse(); // empty text fails Validators.required
    });

    it('flags a group invalid when min is greater than max', () => {
      const group = service.buildQuestionGroup(
        buildQuestion({ type: QuestionType.Integer, min: 10, max: 1 }) as any,
      );

      expect(group.errors?.['minGreaterThanMax']).toBeTrue();
    });

    it('builds a select-options FormArray from the question', () => {
      const group = service.buildQuestionGroup(
        buildQuestion({
          type: QuestionType.Select,
          selectOptions: [{ id: 1, text: 'A' }],
        }) as any,
      );

      expect((group.get('selectOptions') as any).length).toBe(1);
      expect((group.get('selectOptions') as any).at(0).value.text).toBe('A');
    });
  });

  describe('addQuestion / removeQuestion / moveQuestion', () => {
    it('addQuestion appends a new group', () => {
      const array = service.createQuestionsArray();

      service.addQuestion(array);

      expect(array.length).toBe(1);
    });

    it('removeQuestion removes the group and records its id if it had one', () => {
      const array = service.createQuestionsArray([buildQuestion({ id: 'q-1' }) as any]);
      const deletedIds: string[] = [];

      service.removeQuestion(array, 0, deletedIds);

      expect(array.length).toBe(0);
      expect(deletedIds).toEqual(['q-1']);
    });

    it('removeQuestion does not record an id for a brand-new (unsaved) question', () => {
      const array = service.createQuestionsArray();
      service.addQuestion(array);
      const deletedIds: string[] = [];

      service.removeQuestion(array, 0, deletedIds);

      expect(deletedIds).toEqual([]);
    });

    it('moveQuestion swaps order within bounds', () => {
      const array = service.createQuestionsArray([
        buildQuestion({ text: 'A' }) as any,
        buildQuestion({ text: 'B' }) as any,
      ]);

      service.moveQuestion(array, 0, 1);

      expect(array.at(0).value.text).toBe('B');
      expect(array.at(1).value.text).toBe('A');
    });

    it('moveQuestion is a no-op when moving out of bounds', () => {
      const array = service.createQuestionsArray([buildQuestion({ text: 'A' }) as any]);

      service.moveQuestion(array, 0, -1);

      expect(array.at(0).value.text).toBe('A');
    });
  });

  describe('validateQuestions', () => {
    it('returns null when every question is valid', () => {
      const array = service.createQuestionsArray([buildQuestion({ text: 'Q1' }) as any]);

      expect(service.validateQuestions(array)).toBeNull();
    });

    it('flags a min/max ordering error', () => {
      const array = service.createQuestionsArray([
        buildQuestion({ type: QuestionType.Integer, min: 10, max: 1 }) as any,
      ]);

      expect(service.validateQuestions(array)).toContain('Minimalwert');
    });

    it('flags a Select question with no options', () => {
      const array = service.createQuestionsArray([
        buildQuestion({ type: QuestionType.Select, selectOptions: [] }) as any,
      ]);

      expect(service.validateQuestions(array)).toContain('mindestens eine Antwortoption');
    });

    it('flags a Select question with a blank option label', () => {
      const array = service.createQuestionsArray([
        buildQuestion({
          type: QuestionType.Select,
          selectOptions: [{ id: 1, text: '  ' }],
        }) as any,
      ]);

      expect(service.validateQuestions(array)).toContain('nicht leer sein');
    });
  });

  describe('buildQuestionsCreateInput', () => {
    it('builds a createMany payload with sequential order', () => {
      const array = service.createQuestionsArray([
        buildQuestion({ text: 'A' }) as any,
        buildQuestion({ text: 'B' }) as any,
      ]);

      const input = service.buildQuestionsCreateInput(array);

      expect(input.createMany.data.length).toBe(2);
      expect(input.createMany.data[0].order).toBe(0);
      expect(input.createMany.data[1].order).toBe(1);
    });

    it('nulls out type-irrelevant fields (e.g. min/max for a Text question)', () => {
      const array = service.createQuestionsArray([
        buildQuestion({ type: QuestionType.Text, min: 5, max: 10 }) as any,
      ]);

      const input = service.buildQuestionsCreateInput(array);

      expect(input.createMany.data[0].min).toBeNull();
      expect(input.createMany.data[0].max).toBeNull();
    });
  });

  describe('buildQuestionsUpdateInput', () => {
    it('splits existing (has id) vs. new (no id) questions into update/createMany', () => {
      const array = service.createQuestionsArray([
        buildQuestion({ id: 'q-1', text: 'Existing' }) as any,
      ]);
      service.addQuestion(array); // new question, no id

      const input = service.buildQuestionsUpdateInput(array, []);

      expect(input.update?.length).toBe(1);
      expect(input.update?.[0].where).toEqual({ id: 'q-1' });
      expect(input.createMany?.data.length).toBe(1);
    });

    it('includes a deleteMany clause only when there are deleted ids', () => {
      const array = service.createQuestionsArray();

      expect(service.buildQuestionsUpdateInput(array, []).deleteMany).toBeUndefined();
      expect(
        service.buildQuestionsUpdateInput(array, ['q-1']).deleteMany,
      ).toEqual({ id: { in: ['q-1'] } });
    });
  });
});
