import * as z from 'zod';
import {
  AnswerModelSchema,
  QuestionModelSchema,
} from '../../../../shared/generated/zod/schemas';
import { AnswerModel as Answer, QuestionModel as Question } from '../../../../shared/generated/prisma/models';

/**
 * Zod schemas for various types.
 */

export const caseFormDefinitionSchema = z.strictObject({
  name: z.string(),
  type: z.literal(['single', 'multiple']),
  containsPersonalData: z.boolean().default(true),
  questions: QuestionModelSchema.array(),
});

export const generalFormDefinitionSchema = z.strictObject({
  name: z.string(),
  questions: QuestionModelSchema.array(),
});

/**
 * Various utility functions for validation
 */

export function safeParseJson<T>(
  schema: z.ZodType<T>,
  json: string,
): { success: true; data: T } | { success: false; error?: any; data?: T } {
  let data: T;
  try {
    data = JSON.parse(json);
    return schema.safeParse(data);
  } catch (error) {
    return { success: false, error: error as string };
  }
}

export function validateAnswer(question: Question, answer?: Answer): boolean {
  if (question.required && (!answer || answerEmpty(answer))) {
    return false;
  }

  if (question.type === 'Integer') {
    if (question.max && answer?.answerInt! > question.max) return false;
    if (question.min && answer?.answerInt! < question.min) return false;
  }

  if (question.type === 'Float') {
    if (question.max && answer?.answerNum! > question.max) return false;
    if (question.min && answer?.answerNum! < question.min) return false;
  }

  return true;
}

function answerEmpty(answer: Answer) {
  return (
    (!answer.answerSelectId || answer.answerSelectId.length < 1) &&
    answer.answerBool === null &&
    !answer.answerDate &&
    answer.answerInt === null &&
    answer.answerNum === null &&
    answer.answerText === null
  );
}
