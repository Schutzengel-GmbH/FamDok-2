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
  return {
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
    // Controllers only ever call $transaction with an array of operations (never the
    // callback form), so resolving them like Promise.all mirrors real Prisma closely
    // enough for tests, without every test needing to stub the transaction result itself.
    $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
  };
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;
