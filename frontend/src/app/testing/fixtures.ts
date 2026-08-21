import { QuestionType, Role } from '../../../../shared/generated/prisma/enums';

let counter = 0;
function nextId(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function buildQuestion(overrides: Record<string, any> = {}) {
  return {
    id: nextId('question'),
    type: QuestionType.Text as QuestionType,
    required: false,
    text: 'Test question',
    order: 0,
    selectOptions: [],
    multiple: false,
    min: null,
    max: null,
    textAreaRows: null,
    caseFormId: null,
    generalFormId: null,
    ...overrides,
  };
}

export function buildAnswer(overrides: Record<string, any> = {}) {
  return {
    id: nextId('answer'),
    questionId: nextId('question'),
    answerText: null,
    answerInt: null,
    answerNum: null,
    answerBool: null,
    answerDate: null,
    answerSelectId: [] as number[],
    caseFormResponseId: null,
    closingDocumentationId: null,
    generalFormResponseId: null,
    ...overrides,
  };
}

export function buildUser(overrides: Record<string, any> = {}) {
  return {
    id: nextId('user'),
    kcId: nextId('kc'),
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: Role.User,
    jobTitle: null,
    organisationId: nextId('org'),
    organisation: null,
    subOrganisations: [],
    ...overrides,
  };
}
