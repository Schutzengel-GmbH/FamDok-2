/**
 * Builds a jest.fn() stub for every Prisma model method a controller/authFn
 * touches. Kept generic (rather than typed against PrismaClient) since the
 * generated client type is huge and we run tests with isolatedModules
 * (no type-checking) anyway.
 */
function createModelMock() {
  return {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  };
}

export function createPrismaMock() {
  const mock = {
    setting: createModelMock(),
    user: createModelMock(),
    organisation: createModelMock(),
    subOrganisation: createModelMock(),
    case: createModelMock(),
    zielvereinbarung: createModelMock(),
    handover: createModelMock(),
    contactDocumentation: createModelMock(),
    family: createModelMock(),
    child: createModelMock(),
    caregiver: createModelMock(),
    caseForm: createModelMock(),
    caseFormResponse: createModelMock(),
    generalForm: createModelMock(),
    generalFormResponse: createModelMock(),
    closingDocumentation: createModelMock(),
    question: createModelMock(),
    answer: createModelMock(),
    tag: createModelMock(),
    document: createModelMock(),
    caseAttachment: createModelMock(),
    $queryRaw: jest.fn(),
    // Real Prisma $transaction has two overloads: an array of operations, and a callback
    // that receives a transaction-scoped client. Support both; the callback gets the same
    // mock so per-model mockResolvedValue(...) set in a test also applies inside the
    // transaction, without every test needing to stub the transaction result itself.
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: typeof mock) => unknown)(mock)
        : Promise.all(arg as unknown[])
    ),
  };
  return mock;
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;
