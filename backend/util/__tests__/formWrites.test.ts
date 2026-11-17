import {
  answerWrites,
  answersFor,
  questionWrites,
  relationWrite,
} from '../formWrites';

describe('formWrites', () => {
  describe('relationWrite', () => {
    it('leaves the relation alone when no id was given', () => {
      expect(relationWrite(undefined)).toBeUndefined();
    });

    it('connects an id and disconnects null', () => {
      expect(relationWrite('a')).toEqual({ connect: { id: 'a' } });
      expect(relationWrite(null)).toEqual({ disconnect: true });
    });
  });

  describe('answersFor', () => {
    it('gives every question an answer and drops answers to foreign questions', () => {
      const answers = [
        { questionId: 'q1', answerText: 'a' },
        { questionId: 'foreign', answerText: 'b' },
      ];

      expect(answersFor([{ id: 'q1' }, { id: 'q2' }], answers)).toEqual([
        { questionId: 'q1', answerText: 'a' },
        { questionId: 'q2' },
      ]);
    });
  });

  describe('answerWrites', () => {
    it('updates answers with an id, creates the others', () => {
      expect(
        answerWrites([
          { id: 'a1', questionId: 'q1', answerInt: 1 },
          { questionId: 'q2', answerInt: 2 },
        ])
      ).toEqual({
        updateMany: [{ where: { id: 'a1' }, data: { answerInt: 1 } }],
        createMany: { data: [{ questionId: 'q2', answerInt: 2 }] },
      });
    });
  });

  describe('questionWrites', () => {
    const question = { type: 'Text', text: 'Q', order: 0 } as const;

    it('updates questions with an id, creates the others and deletes the removed ones', () => {
      expect(
        questionWrites({
          questions: [{ id: 'q1', ...question }, question],
          deletedQuestionIds: ['q2'],
        })
      ).toEqual({
        update: [{ where: { id: 'q1' }, data: question }],
        createMany: { data: [question] },
        deleteMany: { id: { in: ['q2'] } },
      });
    });

    it('touches nothing when no questions are given', () => {
      expect(questionWrites({})).toEqual({
        update: [],
        createMany: { data: [] },
        deleteMany: { id: { in: [] } },
      });
    });
  });
});
