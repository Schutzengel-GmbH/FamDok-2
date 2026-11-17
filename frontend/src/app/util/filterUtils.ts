import { QuestionModel as Question } from '../../../../shared/generated/prisma/models';
import {
  QuestionType,
  Status,
} from '../../../../shared/generated/prisma/enums';
import type { AnswerWhere, CaseWhere } from '../../../../shared/api';

export type FilterType =
  | 'caseFilter'
  | 'userFilter'
  | 'dateFilter'
  | 'textFilter'
  | 'numFilter'
  | 'selectFilter';

// helper types
export type StringFieldFilter = {
  filter: 'equals' | 'contains';
  value: string;
};

export type NumFieldFilter = {
  filter: 'equals' | 'gt' | 'gte' | 'lt' | 'lte' | 'range';
  value: number | number[];
};

export type DateFieldFilter = {
  filter: 'equals' | 'gt' | 'gte' | 'lt' | 'lte' | 'range';
  value: Date | Date[];
};

export type SingleSelectFieldFilter = {
  fiter: 'equals' | 'not';
  value: PrismaJson.SelectOption;
};

export type MultipleSelectFieldFilter = {
  fiter: 'contains' | 'doesNotContain';
  value: PrismaJson.SelectOption[];
};

export type CaseFilterInput = {
  name?: StringFieldFilter;
  plz?: StringFieldFilter;
  city?: StringFieldFilter;
  startedAt?: DateFieldFilter;
  zielStartedAt?: DateFieldFilter;
  zielFinishBy?: DateFieldFilter;
  closedAt?: DateFieldFilter;
  zielStatus?: Status;
  zielTopic?: string;
};

export function makeCaseFilter(input: CaseFilterInput): CaseWhere {
  const anyZielFilter =
    input.zielFinishBy ||
    input.zielStartedAt ||
    input.zielStatus ||
    input.zielTopic;

  return {
    family: {
      name: input.name ? { [input.name.filter]: input.name.value } : undefined,
    },
    city: input.city ? { [input.city.filter]: input.city.value } : undefined,
    plz: input.plz ? { [input.plz.filter]: input.plz.value } : undefined,
    closedAt: input.closedAt
      ? input.closedAt.filter === 'range'
        ? {
            gte: (input.closedAt.value as Date[])[0],
            lte: (input.closedAt.value as Date[])[1],
          }
        : {
            [input.closedAt.filter]: input.closedAt.value,
          }
      : undefined,
    startedAt: input.startedAt
      ? input.startedAt.filter === 'range'
        ? {
            gte: (input.startedAt.value as Date[])[0],
            lte: (input.startedAt.value as Date[])[1],
          }
        : {
            [input.startedAt.filter]: input.startedAt.value,
          }
      : undefined,
    zielvereinbarungen: anyZielFilter
      ? {
          some: {
            startedAt: input.zielStartedAt
              ? input.zielStartedAt.filter === 'range'
                ? {
                    gte: (input.zielStartedAt.value as Date[])[0],
                    lte: (input.zielStartedAt.value as Date[])[1],
                  }
                : {
                    [input.zielStartedAt.filter]: input.zielStartedAt.value,
                  }
              : undefined,
            finishBy: input.zielFinishBy
              ? input.zielFinishBy.filter === 'range'
                ? {
                    gte: (input.zielFinishBy.value as Date[])[0],
                    lte: (input.zielFinishBy.value as Date[])[1],
                  }
                : {
                    [input.zielFinishBy.filter]: input.zielFinishBy.value,
                  }
              : undefined,
            status: input.zielStatus,
            topic: input.zielTopic,
          },
        }
      : undefined,
  };
}

export function makeTextQuestionFilter(input: {
  question: Question;
  value: string | undefined;
}): AnswerWhere {
  const { question, value } = input;
  return {
    questionId: question.id,
    answerText: { contains: value, mode: 'insensitive' },
  };
}

export function makeNumberQuestionFilter(input: {
  question: Question;
  filter: NumFieldFilter;
}): AnswerWhere {
  const { question, filter } = input;
  if (question.type === QuestionType.Float)
    return {
      questionId: question.id,
      answerNum: { [filter.filter]: filter.value },
    };
  if (question.type === QuestionType.Integer)
    return {
      questionId: question.id,
      answerInt: { [filter.filter]: filter.value },
    };
  return {};
}

export function makeDateQuestionFilter(input: {
  question: Question;
  filter: DateFieldFilter;
}): AnswerWhere {
  const { question, filter } = input;

  return {
    questionId: question.id,
    answerDate:
      filter.filter === 'range'
        ? { lte: (filter.value as Date[])[1], gte: (filter.value as Date[])[0] }
        : { [filter.filter]: filter.value },
  };
}
