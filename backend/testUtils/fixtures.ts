import { Role } from '../../shared/generated/prisma/client';

let counter = 0;
function nextId(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}`;
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

export function buildOrganisation(overrides: Record<string, any> = {}) {
  return {
    id: nextId('org'),
    name: 'Test Org',
    subOrganisations: [],
    ...overrides,
  };
}

export function buildSubOrganisation(overrides: Record<string, any> = {}) {
  return {
    id: nextId('suborg'),
    name: 'Test SubOrg',
    organisationId: nextId('org'),
    ...overrides,
  };
}

export function buildCase(overrides: Record<string, any> = {}) {
  return {
    id: nextId('case'),
    startedAt: new Date('2026-01-01'),
    userId: nextId('user'),
    organisationId: nextId('org'),
    responsibleUsers: [],
    zielvereinbarungen: [],
    migrationBackground: null,
    specificMigrationBackground: null,
    familienstand: null,
    partnerInvolved: null,
    bekanntJA: null,
    city: null,
    plz: null,
    family: buildFamily(),
    familyId: nextId('family'),
    contactDocumentation: [],
    closedAt: null,
    closingDocId: null,
    createdBy: null,
    ...overrides,
  };
}

export function buildFamily(overrides: Record<string, any> = {}) {
  return {
    id: nextId('family'),
    organisationId: nextId('org'),
    name: 'Test Family',
    adress: { city: 'Testville', plz: '12345' },
    phone: null,
    additionalPhones: [],
    children: [],
    caregiver: [],
    case: null,
    ...overrides,
  };
}

export function buildContactDocumentation(overrides: Record<string, any> = {}) {
  return {
    id: nextId('contactdoc'),
    userId: nextId('user'),
    date: new Date('2026-01-01'),
    duration: 30,
    artDerBetreuung: 'Telefon',
    beratungsThemenEltern: [],
    beratungsThemenKinder: [],
    beratungsThemenAllgemein: [],
    zusammenfassung: null,
    dokumentation: null,
    caseId: nextId('case'),
    ...overrides,
  };
}

export function buildHandover(overrides: Record<string, any> = {}) {
  return {
    id: nextId('handover'),
    createdById: nextId('user'),
    caseId: nextId('case'),
    date: new Date('2026-01-01'),
    addedIds: [],
    removedIds: [],
    notes: null,
    ...overrides,
  };
}

export function buildZielvereinbarung(overrides: Record<string, any> = {}) {
  return {
    id: nextId('zv'),
    userId: nextId('user'),
    startedAt: new Date('2026-01-01'),
    finishBy: new Date('2026-02-01'),
    status: 'inProgress',
    topic: 'Topic',
    description: 'Description',
    caseId: nextId('case'),
    ...overrides,
  };
}

export function buildCaseForm(overrides: Record<string, any> = {}) {
  return {
    id: nextId('caseform'),
    name: 'Test CaseForm',
    type: 'multiple',
    containsPersonalData: true,
    isPersonal: false,
    questions: [],
    ...overrides,
  };
}

export function buildCaseFormResponse(overrides: Record<string, any> = {}) {
  return {
    id: nextId('cfr'),
    userId: nextId('user'),
    caseFormId: nextId('caseform'),
    caseId: nextId('case'),
    childId: null,
    caregiverId: null,
    answers: [],
    case: buildCase(),
    ...overrides,
  };
}

export function buildGeneralForm(overrides: Record<string, any> = {}) {
  return {
    id: nextId('genform'),
    name: 'Test GeneralForm',
    questions: [],
    ...overrides,
  };
}

export function buildGeneralFormResponse(overrides: Record<string, any> = {}) {
  return {
    id: nextId('gfr'),
    userId: nextId('user'),
    generalFormId: nextId('genform'),
    answers: [],
    ...overrides,
  };
}

export function buildSetting(overrides: Record<string, any> = {}) {
  return {
    name: 'setting',
    value: 'value',
    ...overrides,
  };
}

export function buildTag(overrides: Record<string, any> = {}) {
  return {
    id: nextId('tag'),
    name: 'Test Tag',
    ...overrides,
  };
}

export function buildDocument(overrides: Record<string, any> = {}) {
  return {
    id: nextId('doc'),
    title: 'Test Document',
    description: null,
    filename: 'test.pdf',
    storageKey: nextId('storagekey'),
    mimeType: 'application/pdf',
    size: 1234,
    tags: [],
    uploadedById: nextId('user'),
    uploadedBy: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function buildCaseAttachment(overrides: Record<string, any> = {}) {
  return {
    id: nextId('attachment'),
    caseId: nextId('case'),
    filename: 'attachment.pdf',
    storageKey: nextId('storagekey'),
    mimeType: 'application/pdf',
    size: 1234,
    note: null,
    uploadedById: nextId('user'),
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}
