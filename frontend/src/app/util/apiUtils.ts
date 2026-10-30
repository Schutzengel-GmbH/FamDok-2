import { AnswerModel as Answer } from '../../../../shared/generated/prisma/models';
import type { AnswerUpdate } from '../../../../shared/api';

/** Serializes a query from `shared/api` the way `route()` in the backend expects it. */
export function toQuery(query?: object): string {
  const json = JSON.stringify(query ?? {});
  return json === '{}' ? '' : `?q=${encodeURIComponent(json)}`;
}

/** Reduces an answer to what can be sent, as the backend rejects everything else. */
export function toAnswerRequest(answer: Partial<Answer>): AnswerUpdate {
  return {
    id: answer.id,
    questionId: answer.questionId!,
    answerBool: answer.answerBool,
    answerDate: answer.answerDate,
    answerInt: answer.answerInt,
    answerNum: answer.answerNum,
    answerSelectId: answer.answerSelectId ?? undefined,
    answerText: answer.answerText,
  };
}
