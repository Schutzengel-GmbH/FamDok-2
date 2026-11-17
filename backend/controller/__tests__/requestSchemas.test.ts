import { ZodType } from 'zod';
import {
  CaseAttachmentRequest,
  CaseCloseRequest,
  CaseCreateRequest,
  CaseFormCreateRequest,
  CaseFormListQuery,
  CaseFormResponseCreateRequest,
  CaseFormResponseListQuery,
  CaseFormResponseUpdateRequest,
  CaseFormUpdateRequest,
  CaseListQuery,
  ChildHealthDataRequest,
  ContactDocumentationCreateRequest,
  ContactDocumentationListQuery,
  ContactDocumentationUpdateRequest,
  FamilyUpdateRequest,
  GeneralFormCreateRequest,
  GeneralFormListQuery,
  GeneralFormResponseCreateRequest,
  GeneralFormResponseListQuery,
  GeneralFormResponseUpdateRequest,
  GeneralFormUpdateRequest,
  HandoverRequest,
  LatestQuery,
  MeUpdateRequest,
  MyCasesQuery,
  OrgRequest,
  OrgUsersQuery,
  SettingUpdateRequest,
  StatsCaseQuery,
  StatsContactDocumentationQuery,
  TagRequest,
  UserEnabledRequest,
  UserUpdateRequest,
  ZielCreateRequest,
  ZielUpdateRequest,
} from '../../../shared/api';

/**
 * Every route's schema with a request it must accept and payloads it must reject. Add a row for
 * every new schema: the payloads are the nested writes that used to reach Prisma.
 */
const role = { update: { data: { role: 'Admin' } } };
const NESTED_WRITES = {
  createdBy: { createdBy: role },
  createdByConnect: { createdBy: { connect: { id: 'someone' } } },
  responsibleUsers: {
    responsibleUsers: {
      update: [{ where: { id: 'me' }, data: { role: 'Admin' } }],
    },
  },
  case: { case: { update: { data: { responsibleUsers: {} } } } },
  caseConnect: { case: { connect: { id: 'foreign-case' } } },
  organisation: { organisation: { connect: { id: 'foreign-org' } } },
  organisationId: { organisationId: 'foreign-org' },
  users: { users: { update: [{ where: { id: 'me' }, data: { role: 'Admin' } }] } },
  subOrganisations: {
    subOrganisations: {
      update: [
        {
          where: { id: 'sub' },
          data: { organisation: { update: { users: {} } } },
        },
      ],
    },
  },
  familyConnect: { family: { connect: { id: 'foreign-family' } } },
  contactDocumentation: {
    contactDocumentation: { connect: [{ id: 'foreign-doc' }] },
  },
  caseformResponses: { caseformResponses: { connect: [{ id: 'foreign' }] } },
  responses: {
    responses: {
      update: [{ where: { id: 'r' }, data: { createdBy: role } }],
    },
  },
  caseForm: { caseForm: { update: { data: {} } } },
  id: { id: 'other' },
  userId: { userId: 'someone' },
};

const zielFields = {
  startedAt: '2026-01-01T00:00:00.000Z',
  finishBy: '2026-02-01T00:00:00.000Z',
  topic: 'Topic',
  description: 'Description',
};

const question = { type: 'Text', text: 'Question', order: 0 };
const answer = { questionId: 'q1', answerText: 'Answer' };
const child = { name: 'Child', dateOfBirth: '2025-01-01' };
const caseFields = { startedAt: '2026-01-01', family: { name: 'Family' } };

const SCHEMAS: [string, ZodType, Record<string, unknown>][] = [
  ['ZielCreateRequest', ZielCreateRequest, zielFields],
  ['ZielUpdateRequest', ZielUpdateRequest, { topic: 'New' }],
  ['ContactDocumentationCreateRequest', ContactDocumentationCreateRequest, {}],
  [
    'ContactDocumentationUpdateRequest',
    ContactDocumentationUpdateRequest,
    { dokumentation: 'Text', beratungsThemenKinder: [1] },
  ],
  ['FamilyUpdateRequest', FamilyUpdateRequest, { name: 'New', children: [child] }],
  ['ChildHealthDataRequest', ChildHealthDataRequest, { healthData: [] }],
  [
    'CaseFormCreateRequest',
    CaseFormCreateRequest,
    { name: 'Form', type: 'single', questions: [question] },
  ],
  [
    'CaseFormUpdateRequest',
    CaseFormUpdateRequest,
    { questions: [{ id: 'q1', ...question }], deletedQuestionIds: ['q2'] },
  ],
  [
    'GeneralFormCreateRequest',
    GeneralFormCreateRequest,
    { name: 'Form', questions: [question] },
  ],
  ['GeneralFormUpdateRequest', GeneralFormUpdateRequest, { name: 'New' }],
  [
    'CaseFormResponseCreateRequest',
    CaseFormResponseCreateRequest,
    { caseId: 'c', caseFormId: 'f', answers: [answer] },
  ],
  [
    'CaseFormResponseUpdateRequest',
    CaseFormResponseUpdateRequest,
    { childId: null, answers: [{ id: 'a', ...answer }] },
  ],
  [
    'GeneralFormResponseCreateRequest',
    GeneralFormResponseCreateRequest,
    { generalFormId: 'f', answers: [answer] },
  ],
  [
    'GeneralFormResponseUpdateRequest',
    GeneralFormResponseUpdateRequest,
    { answers: [{ id: 'a', ...answer }] },
  ],
  ['OrgRequest', OrgRequest, { name: 'Org' }],
  ['UserUpdateRequest', UserUpdateRequest, { firstName: 'New' }],
  ['UserEnabledRequest', UserEnabledRequest, { enabled: true }],
  ['MeUpdateRequest', MeUpdateRequest, { firstName: 'New' }],
  ['SettingUpdateRequest', SettingUpdateRequest, { value: '30' }],
  ['TagRequest', TagRequest, { name: 'Tag' }],
  ['CaseAttachmentRequest', CaseAttachmentRequest, { note: 'Note' }],
  ['CaseCloseRequest', CaseCloseRequest, { date: '2026-01-01' }],
  [
    'HandoverRequest',
    HandoverRequest,
    { caseId: 'c', date: '2026-01-01', removedIds: [], addedIds: ['u'] },
  ],
  ['LatestQuery', LatestQuery, { n: 3 }],
];

const cityFilter = { city: { contains: 'Ber' } };

/** Each of these used to let someone probe data they can't see, one letter at a time. */
const CASE_FILTER_PROBES = {
  'family via is': { family: { is: { name: { startsWith: 'A' } } } },
  'family phone': { family: { phone: { startsWith: '0' } } },
  'family of the organisation': {
    organisation: { families: { some: { name: { startsWith: 'A' } } } },
  },
  'contact documentation text': {
    contactDocumentation: { some: { dokumentation: { contains: 'x' } } },
  },
  'ziel description': {
    zielvereinbarungen: { some: { description: { contains: 'x' } } },
  },
  'responsible users': {
    responsibleUsers: { some: { cases: { some: { familyId: 'x' } } } },
  },
  'created by': { createdBy: { email: { startsWith: 'a' } } },
  'form responses': { caseformResponses: { some: {} } },
  'the family id': { familyId: 'x' },
  and: { AND: [{ familyId: 'x' }] },
  or: { OR: [{ family: { name: 'x' } }] },
  not: { NOT: { family: { name: 'x' } } },
};

const CASE_QUERIES: [string, ZodType, (where: unknown) => unknown][] = [
  ['CaseListQuery', CaseListQuery, (where) => ({ where })],
  ['MyCasesQuery', MyCasesQuery, (where) => ({ where })],
  ['StatsCaseQuery', StatsCaseQuery, (where) => ({ where })],
  [
    'StatsContactDocumentationQuery',
    StatsContactDocumentationQuery,
    (caseFilter) => ({ caseFilter }),
  ],
  [
    'ContactDocumentationListQuery',
    ContactDocumentationListQuery,
    (where) => ({ where: { case: where } }),
  ],
  [
    'CaseFormResponseListQuery',
    CaseFormResponseListQuery,
    (where) => ({ where: { case: where } }),
  ],
];

describe.each(CASE_QUERIES)('case filter of %s', (_, schema, query) => {
  it('accepts what the UI filters by', () => {
    expect(schema.safeParse(query(cityFilter)).success).toBe(true);
  });

  it.each(Object.entries(CASE_FILTER_PROBES))('rejects %s', (_, probe) => {
    expect(schema.safeParse(query(probe)).success).toBe(false);
  });
});

describe('queries', () => {
  it('has no way to request additional relations', () => {
    const include = { organisation: { include: { families: true } } };

    expect(MyCasesQuery.safeParse({ include }).success).toBe(false);
  });

  it('does not filter statistics by family', () => {
    const where = { family: { name: { startsWith: 'A' } } };

    expect(StatsCaseQuery.safeParse({ where }).success).toBe(false);
    expect(CaseListQuery.safeParse({ where }).success).toBe(true);
  });

  it('does not filter statistics by anything but the date of documentation', () => {
    const docFilter = { case: { family: { name: 'x' } } };

    expect(
      StatsContactDocumentationQuery.safeParse({ docFilter }).success
    ).toBe(false);
  });

  it.each([
    ['cases', { cases: { some: { family: { name: 'x' } } } }],
    ['the role', { role: 'Admin' }],
    ['the email', { email: { startsWith: 'a' } }],
  ])('does not filter users by %s', (_, where) => {
    expect(OrgUsersQuery.safeParse({ where }).success).toBe(false);
  });

  it.each([
    [
      'answers of another form',
      CaseFormResponseListQuery,
      { case: { family: { case: {} } } },
    ],
    [
      'who created the response',
      GeneralFormResponseListQuery,
      { createdBy: { cases: { some: { family: { name: 'x' } } } } },
    ],
    [
      'the case of contact documentation',
      ContactDocumentationListQuery,
      { createdBy: { email: { startsWith: 'a' } } },
    ],
    ['form responses', CaseFormListQuery, { caseFormResponses: { some: {} } }],
    [
      'general form responses',
      GeneralFormListQuery,
      { responses: { some: {} } },
    ],
  ])('does not filter by %s', (_, schema, where) => {
    expect(schema.safeParse({ where }).success).toBe(false);
  });
});

/** `family` is the one nested object that is allowed here, so it needs its own payloads. */
describe('CaseCreateRequest', () => {
  it('accepts a case with its family', () => {
    expect(CaseCreateRequest.safeParse(caseFields).success).toBe(true);
  });

  it.each(Object.entries(NESTED_WRITES))('rejects %s', (_, payload) => {
    const { family, ...rest } = payload as Record<string, unknown>;
    const nestedInCase = { ...caseFields, ...rest };
    const nestedInFamily = {
      ...caseFields,
      family: { ...caseFields.family, ...payload },
    };

    if (!family)
      expect(CaseCreateRequest.safeParse(nestedInCase).success).toBe(false);
    expect(CaseCreateRequest.safeParse(nestedInFamily).success).toBe(false);
  });
});

describe('nested lists', () => {
  it.each(Object.entries(NESTED_WRITES))('rejects %s in children', (_, payload) => {
    const children = [{ ...child, ...payload }];
    // `id` is how a child keeps its identity when the family is saved
    if ('id' in payload) return;
    expect(FamilyUpdateRequest.safeParse({ children }).success).toBe(false);
  });

  it.each(Object.entries(NESTED_WRITES))('rejects %s in answers', (_, payload) => {
    const answers = [{ ...answer, ...payload }];
    if ('id' in payload) return;
    expect(
      GeneralFormResponseUpdateRequest.safeParse({ answers }).success
    ).toBe(false);
  });

  it.each(Object.entries(NESTED_WRITES))('rejects %s in questions', (_, payload) => {
    const questions = [{ ...question, ...payload }];
    if ('id' in payload) return;
    expect(CaseFormUpdateRequest.safeParse({ questions }).success).toBe(false);
  });
});

describe.each(SCHEMAS)('%s', (_, schema, valid) => {
  it('accepts a valid request', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each(Object.entries(NESTED_WRITES))('rejects %s', (key, payload) => {
    // the one schema where this is a real field: `canEditUser` limits who may change it
    if (schema === UserUpdateRequest && key === 'organisationId') return;
    expect(schema.safeParse({ ...valid, ...payload }).success).toBe(false);
  });
});
