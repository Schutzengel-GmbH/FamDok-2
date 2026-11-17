import { Prisma } from '../../shared/generated/prisma/client';
import {
  AnswerCreate,
  AnswerUpdate,
  CaseFormUpdateRequest,
} from '../../shared/api';

/** `{ connect }` or `{ disconnect }` for an optional relation, nothing if `id` wasn't given. */
export function relationWrite(id: string | null | undefined) {
  if (id === undefined) return undefined;
  return id ? { connect: { id } } : { disconnect: true };
}

/**
 * Makes sure there is always an answer to every question, so we never run into the issue of
 * having to "upsertMany" which doesn't exist in prisma.
 */
export function answersFor(
  questions: { id: string }[],
  answers: AnswerCreate[]
): AnswerCreate[] {
  return questions.map((q) => ({
    questionId: q.id,
    ...answers.find((a) => a.questionId === q.id),
  }));
}

/** Nested write for the answers of a response, which keeps it from reaching other responses. */
export function answerWrites(answers: AnswerUpdate[]) {
  const updateMany: Prisma.AnswerUpdateManyWithWhereWithoutCaseFormResponseInput[] =
    [];
  const data: AnswerCreate[] = [];

  for (const { id, ...answer } of answers) {
    if (id) {
      const { questionId, ...fields } = answer;
      updateMany.push({ where: { id }, data: fields });
    } else data.push(answer);
  }

  return { updateMany, createMany: { data } };
}

/** Nested write for the questions of a form, which keeps it from reaching other forms. */
export function questionWrites({
  questions = [],
  deletedQuestionIds = [],
}: Pick<CaseFormUpdateRequest, 'questions' | 'deletedQuestionIds'>) {
  const toCreate = questions.filter((q) => !q.id);

  return {
    update: questions.flatMap(({ id, ...data }) =>
      id ? [{ where: { id }, data }] : []
    ),
    createMany: {
      data: toCreate.map(({ id, ...question }) => question),
    },
    deleteMany: { id: { in: deletedQuestionIds } },
  };
}
