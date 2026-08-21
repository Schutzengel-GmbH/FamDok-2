/**
 * Development seed script.
 *
 * Populates the database (and the matching Keycloak realm) with a realistic set of dev data:
 * all case/general form definitions from shared/definitions, the "Abschlussdokumentation"
 * closing-doc setting, and two symmetric organisations ("Organisation 1"/"Organisation 2"),
 * each with 2 suborganisations and the same set of users/cases/documentation.
 *
 * Every non-Admin role gets a dedicated test user per org/suborg, with a predictable Keycloak
 * username (and matching email `<username>@dev.local`) so it's easy to log in as a specific
 * kind of user directly:
 *   - `controller`                          (Controller - global, not org-specific)
 *   - `orgcontroller-org1` / `-org2`        (OrgController)
 *   - `orgcoordinator-org1` / `-org2`       (OrgCoordinator)
 *   - `suborgcoordinator-org1-sub1` / `-sub2` / `-org2-sub1` / `-sub2` (SubOrgCoordinator)
 *   - `user1-org1` .. `user4-org1`, `user1-org2` .. `user4-org2`      (User / case workers)
 * All Keycloak users share the password "12345".
 *
 * To keep "unfinished form"/"missing data" warnings predictable to test, only 1-2 contact
 * documentations and 1-2 case form responses (including the closing doc) per case worker are
 * intentionally left incomplete - everything else is fully filled out.
 *
 * Assumes the Postgres database and Keycloak are already running and reachable via the usual
 * backend/.env configuration. Safe to run against a non-empty database - it only skips/reuses
 * data it recognizes (form definitions by name, the closing_doc setting, Keycloak users by
 * username) and aborts up front if it looks like it has already seeded its own org data before,
 * so it won't create duplicates on a second run.
 *
 * Usage: npm run seed:dev (from backend/, or from the repo root)
 */
import {
  addMonths,
  max as dateMax,
  min as dateMin,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import '../../shared/sharedGlobals';
import { prisma } from '../db';
import getAdminClient from '../kcAdminClient';
import { KC_REALM } from '../config';
import {
  Familienstand,
  Gender,
  Relation,
  Role,
} from '../../shared/generated/prisma/client';
import {
  AnswerCreateManyCaseFormResponseInput,
  AnswerCreateManyGeneralFormResponseInput,
  CaseFormGetPayload,
  ContactDocumentationCreateManyInput,
  GeneralFormGetPayload,
} from '../../shared/generated/prisma/models';
import {
  seedCaseForms,
  seedGeneralForms,
  setClosingDocSetting,
} from './seedFormDefinitions';

const DEV_PASSWORD = '12345';

type FormWithQuestions =
  | CaseFormGetPayload<{ include: { questions: true } }>
  | GeneralFormGetPayload<{ include: { questions: true } }>;
type SeedQuestion = FormWithQuestions['questions'][number];

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------

function chance(probability: number): boolean {
  return Math.random() < probability;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  const value = min + Math.random() * (max - min);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Picks `count` distinct random elements from `arr` (count is clamped to arr.length). */
function randomElements<T>(arr: readonly T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(0, Math.min(count, arr.length)));
}

function randomDate(start: Date, end: Date): Date {
  if (end.getTime() <= start.getTime()) return new Date(start.getTime());
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// ---------------------------------------------------------------------------
// Name / text pools
// ---------------------------------------------------------------------------

const CHILD_FIRST_NAMES_M = [
  'Ben', 'Finn', 'Elias', 'Noah', 'Leon', 'Paul', 'Luis', 'Jonas', 'Theo', 'Emil',
];
const CHILD_FIRST_NAMES_F = [
  'Mia', 'Emma', 'Lina', 'Ida', 'Lea', 'Clara', 'Frieda', 'Marie', 'Nele', 'Hanna',
];
const ADULT_FIRST_NAMES_M = [
  'Michael', 'Thomas', 'Stefan', 'Andreas', 'Christian', 'Markus', 'Daniel', 'Sebastian', 'Martin', 'Florian',
];
const ADULT_FIRST_NAMES_F = [
  'Sandra', 'Julia', 'Nicole', 'Katrin', 'Melanie', 'Christina', 'Nadine', 'Susanne', 'Vanessa', 'Kerstin',
];
const LAST_NAMES = [
  'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker',
  'Schulz', 'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf',
  'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Krüger', 'Hofmann', 'Lange', 'Schmitt',
];
const CITIES = [
  'Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt', 'Stuttgart',
  'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen',
];
const STREETS = [
  'Hauptstr.', 'Bahnhofstr.', 'Schulstr.', 'Gartenstr.', 'Dorfstr.',
  'Bergstr.', 'Lindenstr.', 'Ringstr.', 'Waldstr.', 'Feldstr.',
];
const FAMILY_NOTES = [
  'Familie ist gut vernetzt im Stadtteil.',
  'Sprachbarriere, Übersetzung teils nötig.',
  'Regelmäßiger telefonischer Kontakt bevorzugt.',
  'Termine bitte vormittags vereinbaren.',
  'Unterstützung durch Großeltern vor Ort.',
];
const LOREM_WORDS = [
  'Familie', 'Unterstützung', 'Entwicklung', 'Gespräch', 'Termin', 'Situation',
  'Kontakt', 'Angebot', 'Beratung', 'Alltag', 'Netzwerk', 'Ressourcen', 'Belastung',
  'Fortschritt', 'Zusammenarbeit', 'Vertrauen', 'Bedarf', 'Umfeld', 'Wohnsituation',
  'Betreuung', 'stabil', 'unauffällig', 'positiv', 'weiterhin', 'gemeinsam', 'besprochen',
];

function sentence(minWords = 6, maxWords = 14): string {
  const words = Array.from({ length: randomInt(minWords, maxWords) }, () =>
    randomElement(LOREM_WORDS)
  );
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}

function paragraph(): string {
  return Array.from({ length: randomInt(2, 4) }, () => sentence()).join(' ');
}

/** A random (cosmetic) person name, for display purposes - login uses `username`, not this. */
function randomPersonName(): { firstName: string; lastName: string } {
  const isMale = chance(0.5);
  return {
    firstName: isMale
      ? randomElement(ADULT_FIRST_NAMES_M)
      : randomElement(ADULT_FIRST_NAMES_F),
    lastName: randomElement(LAST_NAMES),
  };
}

// ---------------------------------------------------------------------------
// Organisations & users (+ matching Keycloak accounts)
// ---------------------------------------------------------------------------

async function seedOrganisations() {
  const existing = await prisma.organisation.findFirst({
    where: { name: { in: ['Organisation 1', 'Organisation 2'] } },
  });
  if (existing)
    throw new Error(
      `Organisation "${existing.name}" already exists - this seed script looks like it already ran ` +
        'against this database. Aborting to avoid creating duplicate dev data.'
    );

  const org1 = await prisma.organisation.create({ data: { name: 'Organisation 1' } });
  const org2 = await prisma.organisation.create({ data: { name: 'Organisation 2' } });
  console.log(`  created organisations "${org1.name}" and "${org2.name}"`);

  const org1Sub1 = await prisma.subOrganisation.create({
    data: { name: 'Organisation 1 - Sub 1', organisationId: org1.id },
  });
  const org1Sub2 = await prisma.subOrganisation.create({
    data: { name: 'Organisation 1 - Sub 2', organisationId: org1.id },
  });
  const org2Sub1 = await prisma.subOrganisation.create({
    data: { name: 'Organisation 2 - Sub 1', organisationId: org2.id },
  });
  const org2Sub2 = await prisma.subOrganisation.create({
    data: { name: 'Organisation 2 - Sub 2', organisationId: org2.id },
  });
  console.log('  created suborganisations for both organisations');

  return { org1, org2, org1Sub1, org1Sub2, org2Sub1, org2Sub2 };
}

interface SeedUserDef {
  username: string;
  firstName: string;
  lastName: string;
  role: Role;
  jobTitle?: string;
  subOrganisationIds?: string[];
}

function emailFor(username: string): string {
  return `${username}@dev.local`;
}

async function ensureKeycloakUser(
  adminClient: Awaited<ReturnType<typeof getAdminClient>>,
  def: SeedUserDef
): Promise<string> {
  const found = await adminClient.users.find({
    username: def.username,
    realm: KC_REALM,
    exact: true,
  });

  let kcId: string;
  if (found[0]?.id) {
    kcId = found[0].id;
  } else {
    const created = await adminClient.users.create({
      realm: KC_REALM,
      username: def.username,
      email: emailFor(def.username),
      firstName: def.firstName,
      lastName: def.lastName,
      enabled: true,
      emailVerified: true,
    });
    kcId = created.id;
  }

  await adminClient.users.resetPassword({
    id: kcId,
    realm: KC_REALM,
    credential: { type: 'password', value: DEV_PASSWORD, temporary: false },
  });

  return kcId;
}

async function createUser(
  adminClient: Awaited<ReturnType<typeof getAdminClient>>,
  def: SeedUserDef,
  organisationId: string
) {
  const kcId = await ensureKeycloakUser(adminClient, def);

  const user = await prisma.user.create({
    data: {
      kcId,
      email: emailFor(def.username),
      firstName: def.firstName,
      lastName: def.lastName,
      role: def.role,
      jobTitle: def.jobTitle,
      organisationId,
      subOrganisations: def.subOrganisationIds
        ? { connect: def.subOrganisationIds.map((id) => ({ id })) }
        : undefined,
    },
  });
  console.log(`  created user "${def.username}" (${user.role})`);

  return user;
}

const CASE_WORKER_JOB_TITLES = [
  'Familienhebamme',
  'Sozialarbeiter',
  'Familienkinderkrankenschwester',
  'Sozialpädagoge',
];

interface OrgUserSet {
  orgController: Awaited<ReturnType<typeof createUser>>;
  orgCoordinator: Awaited<ReturnType<typeof createUser>>;
  subOrgCoordinators: Awaited<ReturnType<typeof createUser>>[];
  caseWorkers: {
    user: Awaited<ReturnType<typeof createUser>>;
    subOrganisationId: string;
  }[];
}

/** Creates the full set of test users for one organisation: an OrgController, an
 * OrgCoordinator, one SubOrgCoordinator per suborg, and one case worker (User) per suborg per
 * job title, split evenly across the org's suborgs. */
async function seedOrgUsers(
  adminClient: Awaited<ReturnType<typeof getAdminClient>>,
  orgLabel: string,
  org: { id: string },
  subOrgs: { id: string }[]
): Promise<OrgUserSet> {
  const orgController = await createUser(
    adminClient,
    {
      ...randomPersonName(),
      username: `orgcontroller-${orgLabel}`,
      role: Role.OrgController,
      jobTitle: 'Leitung Frühe Hilfen',
    },
    org.id
  );

  const orgCoordinator = await createUser(
    adminClient,
    {
      ...randomPersonName(),
      username: `orgcoordinator-${orgLabel}`,
      role: Role.OrgCoordinator,
      jobTitle: 'Koordination Frühe Hilfen',
    },
    org.id
  );

  const subOrgCoordinators = [];
  for (let i = 0; i < subOrgs.length; i++) {
    subOrgCoordinators.push(
      await createUser(
        adminClient,
        {
          ...randomPersonName(),
          username: `suborgcoordinator-${orgLabel}-sub${i + 1}`,
          role: Role.SubOrgCoordinator,
          jobTitle: 'Koordination Frühe Hilfen',
          subOrganisationIds: [subOrgs[i].id],
        },
        org.id
      )
    );
  }

  const caseWorkers: OrgUserSet['caseWorkers'] = [];
  for (let i = 0; i < CASE_WORKER_JOB_TITLES.length; i++) {
    const subOrg = subOrgs[i % subOrgs.length];
    const user = await createUser(
      adminClient,
      {
        ...randomPersonName(),
        username: `user${i + 1}-${orgLabel}`,
        role: Role.User,
        jobTitle: CASE_WORKER_JOB_TITLES[i],
        subOrganisationIds: [subOrg.id],
      },
      org.id
    );
    caseWorkers.push({ user, subOrganisationId: subOrg.id });
  }

  return { orgController, orgCoordinator, subOrgCoordinators, caseWorkers };
}

// ---------------------------------------------------------------------------
// Families / cases
// ---------------------------------------------------------------------------

function buildChild(lastName: string) {
  const isMale = chance(0.5);
  const gender = isMale ? Gender.male : Gender.female;
  const name = isMale
    ? randomElement(CHILD_FIRST_NAMES_M)
    : randomElement(CHILD_FIRST_NAMES_F);

  return {
    name,
    lastName,
    gender,
    dateOfBirth: randomDate(subYears(new Date(), 6), new Date()),
  };
}

function buildCaregiver(lastName: string) {
  const isMale = chance(0.5);
  const gender = isMale ? Gender.male : Gender.female;
  const name = isMale
    ? randomElement(ADULT_FIRST_NAMES_M)
    : randomElement(ADULT_FIRST_NAMES_F);
  const relation = isMale
    ? randomElement([Relation.father, Relation.grandparent, Relation.other, Relation.partner])
    : randomElement([Relation.mother, Relation.grandparent, Relation.other, Relation.partner]);

  return {
    name,
    lastName: chance(0.85) ? lastName : randomElement(LAST_NAMES),
    gender,
    relation,
    dateOfBirth: randomDate(subYears(new Date(), 45), subYears(new Date(), 18)),
  };
}

async function createFamilyWithCase(
  userId: string,
  organisationId: string,
  subOrganisationId?: string
) {
  const lastName = randomElement(LAST_NAMES);

  const address: PrismaJson.Address = {
    street: randomElement(STREETS),
    number: `${randomInt(1, 150)}`,
    plz: `${randomInt(10000, 99999)}`,
    city: randomElement(CITIES),
  };

  const family = await prisma.family.create({
    data: {
      organisationId,
      name: lastName,
      note: chance(0.25) ? randomElement(FAMILY_NOTES) : undefined,
      adress: address,
      phone: `01${randomInt(50, 79)} ${randomInt(1000000, 9999999)}`,
      additionalPhones: [],
      children: { create: Array.from({ length: randomInt(1, 3) }, () => buildChild(lastName)) },
      caregiver: { create: Array.from({ length: randomInt(1, 2) }, () => buildCaregiver(lastName)) },
    },
  });

  const startedAt = randomDate(subMonths(new Date(), 24), subMonths(new Date(), 1));

  const familyCase = await prisma.case.create({
    data: {
      startedAt,
      userId,
      organisationId,
      subOrganisationId,
      familyId: family.id,
      responsibleUsers: { connect: [{ id: userId }] },
      migrationBackground: chance(0.75) ? chance(0.4) : undefined,
      familienstand: chance(0.8)
        ? randomElement([
            Familienstand.ledig,
            Familienstand.verheiratet,
            Familienstand.geschieden,
            Familienstand.unspecified,
          ])
        : undefined,
      partnerInvolved: chance(0.75) ? chance(0.6) : undefined,
      bekanntJA: chance(0.75) ? chance(0.3) : undefined,
      city: address.city,
      plz: address.plz,
    },
  });

  return { family, case: familyCase, startedAt };
}

/** Among a user's cases, closes 1-3 of the ones that started more than a year ago. */
async function closeSomeOlderCases(
  cases: { case: { id: string }; startedAt: Date }[]
) {
  const now = new Date();
  const olderCases = cases.filter((c) => c.startedAt <= subMonths(now, 12));
  const toClose = randomElements(olderCases, randomInt(1, 3));

  const closedIds = new Set<string>();
  for (const entry of toClose) {
    const earliestClose = addMonths(entry.startedAt, 2);
    const latestClose = dateMin([addMonths(entry.startedAt, 15), subDays(now, 1)]);
    const closedAt = randomDate(earliestClose, dateMax([earliestClose, latestClose]));

    await prisma.case.update({ where: { id: entry.case.id }, data: { closedAt } });
    closedIds.add(entry.case.id);
  }

  return closedIds;
}

// ---------------------------------------------------------------------------
// Contact documentation - fully filled out by default, except 1-2 per user
// ---------------------------------------------------------------------------

function randomInts(min: number, max: number, count: number): number[] {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return randomElements(options, count);
}

function buildContactDocumentationData(
  caseId: string,
  userId: string,
  startedAt: Date,
  endDate: Date,
  complete: boolean
): ContactDocumentationCreateManyInput {
  if (complete) {
    return {
      userId,
      caseId,
      date: randomDate(startedAt, endDate),
      duration: randomInt(15, 90),
      artDerBetreuung: randomInt(0, 6),
      beratungsThemenEltern: randomInts(0, 9, randomInt(1, 3)),
      beratungsThemenKinder: randomInts(0, 9, randomInt(1, 3)),
      beratungsThemenAllgemein: randomInts(0, 10, randomInt(1, 3)),
      zusammenfassung: sentence(8, 16),
      dokumentation: paragraph(),
    };
  }

  // Intentionally incomplete, to give the "missing data" warnings something to flag.
  return {
    userId,
    caseId,
    date: chance(0.5) ? randomDate(startedAt, endDate) : undefined,
    duration: undefined,
    artDerBetreuung: undefined,
    beratungsThemenEltern: [],
    beratungsThemenKinder: [],
    beratungsThemenAllgemein: [],
    zusammenfassung: undefined,
    dokumentation: undefined,
  };
}

/**
 * Creates contact documentation across all of a user's cases, with exactly 1-2 entries
 * (picked at random, across the whole user - not per case) left intentionally incomplete.
 */
async function addContactDocumentationForUser(
  userId: string,
  cases: { caseId: string; startedAt: Date; endDate: Date }[]
) {
  const slots = cases.flatMap((c) =>
    Array.from({ length: randomInt(3, 8) }, () => c)
  );
  if (slots.length === 0) return;

  const incompleteIdx = new Set(
    randomElements(
      Array.from({ length: slots.length }, (_, i) => i),
      Math.min(randomInt(1, 2), slots.length)
    )
  );

  const data = slots.map((slot, i) =>
    buildContactDocumentationData(
      slot.caseId,
      userId,
      slot.startedAt,
      slot.endDate,
      !incompleteIdx.has(i)
    )
  );

  await prisma.contactDocumentation.createMany({ data });
}

// ---------------------------------------------------------------------------
// Case form / general form answers
// ---------------------------------------------------------------------------

function buildAnswerValue(
  question: SeedQuestion
):
  | Partial<
      Pick<
        AnswerCreateManyCaseFormResponseInput,
        'answerText' | 'answerInt' | 'answerNum' | 'answerDate' | 'answerSelectId'
      >
    >
  | null {
  switch (question.type) {
    case 'Text':
      return { answerText: sentence(2, 6) };
    case 'Textarea':
      return { answerText: paragraph() };
    case 'Integer': {
      const min = Math.round(question.min ?? 0);
      const max = Math.round(question.max ?? Math.max(min + 10, 20));
      return { answerInt: randomInt(min, Math.max(min, max)) };
    }
    case 'Float': {
      const min = question.min ?? 0;
      const max = question.max ?? Math.max(min + 10, 10);
      return { answerNum: randomFloat(min, Math.max(min, max)) };
    }
    case 'Date':
      return { answerDate: randomDate(subYears(new Date(), 2), new Date()) };
    case 'Select': {
      const options = question.selectOptions as PrismaJson.SelectOption[];
      if (!options?.length) return null;
      const count = question.multiple ? randomInt(1, Math.min(3, options.length)) : 1;
      return { answerSelectId: randomElements(options, count).map((o) => o.id) };
    }
    default:
      return null;
  }
}

/**
 * Builds answers for a form's questions. Fully complete by default (every question answered);
 * pass non-zero skip probabilities to deliberately leave some (including required) questions
 * unanswered, for the small number of forms per user that should look incomplete.
 */
function buildAnswers(
  questions: SeedQuestion[],
  requiredSkipProbability = 0,
  optionalSkipProbability = 0
): AnswerCreateManyCaseFormResponseInput[] {
  const answers: AnswerCreateManyCaseFormResponseInput[] = [];

  for (const question of questions) {
    const skipProbability = question.required
      ? requiredSkipProbability
      : optionalSkipProbability;
    if (skipProbability > 0 && chance(skipProbability)) continue;

    const value = buildAnswerValue(question);
    if (!value) continue;

    answers.push({ questionId: question.id, ...value });
  }

  return answers;
}

/**
 * Creates case form responses across all of a user's cases (one response per fillable single
 * form chosen per case, plus a closing-doc response for each closed case), with exactly 1-2
 * responses (picked at random, across the whole user) left intentionally incomplete.
 */
async function addCaseFormResponsesForUser(
  userId: string,
  cases: { caseId: string; closed: boolean }[],
  fillableSingleForms: CaseFormGetPayload<{ include: { questions: true } }>[],
  closingForm: CaseFormGetPayload<{ include: { questions: true } }>
) {
  const slots: {
    caseId: string;
    form: CaseFormGetPayload<{ include: { questions: true } }>;
  }[] = [];

  for (const c of cases) {
    if (fillableSingleForms.length > 0) {
      const chosenForms = randomElements(
        fillableSingleForms,
        randomInt(1, fillableSingleForms.length)
      );
      for (const form of chosenForms) slots.push({ caseId: c.caseId, form });
    }
    if (c.closed) slots.push({ caseId: c.caseId, form: closingForm });
  }
  if (slots.length === 0) return;

  const incompleteIdx = new Set(
    randomElements(
      Array.from({ length: slots.length }, (_, i) => i),
      Math.min(randomInt(1, 2), slots.length)
    )
  );

  for (let i = 0; i < slots.length; i++) {
    const { caseId, form } = slots[i];
    const complete = !incompleteIdx.has(i);

    await prisma.caseFormResponse.create({
      data: {
        userId,
        caseFormId: form.id,
        caseId,
        answers: {
          createMany: {
            data: complete ? buildAnswers(form.questions) : buildAnswers(form.questions, 0.4, 0.6),
          },
        },
      },
    });
  }
}

async function addGeneralFormResponses(
  userId: string,
  generalForms: GeneralFormGetPayload<{ include: { questions: true } }>[]
) {
  if (generalForms.length === 0) return;

  const count = randomInt(0, 4);
  for (let i = 0; i < count; i++) {
    const form = randomElement(generalForms);
    await prisma.generalFormResponse.create({
      data: {
        userId,
        generalFormId: form.id,
        answers: { createMany: { data: buildAnswers(form.questions) } },
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Per-user case data
// ---------------------------------------------------------------------------

async function seedCasesForUser(
  user: { id: string },
  organisationId: string,
  subOrganisationId: string,
  fillableSingleForms: CaseFormGetPayload<{ include: { questions: true } }>[],
  closingForm: CaseFormGetPayload<{ include: { questions: true } }>
) {
  const created = await Promise.all(
    Array.from({ length: randomInt(8, 12) }, () =>
      createFamilyWithCase(user.id, organisationId, subOrganisationId)
    )
  );

  const closedIds = await closeSomeOlderCases(created);

  const casesForContactDocs = await Promise.all(
    created.map(async (entry) => ({
      caseId: entry.case.id,
      startedAt: entry.startedAt,
      endDate: closedIds.has(entry.case.id)
        ? await prisma.case
            .findUniqueOrThrow({ where: { id: entry.case.id } })
            .then((c) => c.closedAt!)
        : new Date(),
    }))
  );

  await addContactDocumentationForUser(user.id, casesForContactDocs);

  await addCaseFormResponsesForUser(
    user.id,
    created.map((entry) => ({
      caseId: entry.case.id,
      closed: closedIds.has(entry.case.id),
    })),
    fillableSingleForms,
    closingForm
  );

  return { familyCount: created.length, closedCount: closedIds.size };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding dev database...');

  console.log('Creating organisations...');
  const { org1, org2, org1Sub1, org1Sub2, org2Sub1, org2Sub2 } = await seedOrganisations();

  console.log('Creating form definitions...');
  const caseForms = await seedCaseForms();
  const generalForms = await seedGeneralForms();

  console.log('Configuring closing doc setting...');
  const closingForm = await setClosingDocSetting(
    caseForms,
    'Abschlussdokumentation'
  );
  if (!closingForm) throw new Error('Failed to set closing_doc setting');
  const fillableSingleForms = caseForms.filter(
    (f) => f.type === 'single' && f.id !== closingForm.id
  );

  console.log('Creating users (Postgres + Keycloak)...');
  const adminClient = await getAdminClient();

  const controller = await createUser(
    adminClient,
    {
      ...randomPersonName(),
      username: 'controller',
      role: Role.Controller,
      jobTitle: 'Jugendamt',
    },
    org1.id
  );

  const org1Users = await seedOrgUsers(adminClient, 'org1', org1, [org1Sub1, org1Sub2]);
  const org2Users = await seedOrgUsers(adminClient, 'org2', org2, [org2Sub1, org2Sub2]);

  console.log('Creating families, cases and documentation...');
  for (const { user, subOrganisationId, organisationId } of [
    ...org1Users.caseWorkers.map((c) => ({ ...c, organisationId: org1.id })),
    ...org2Users.caseWorkers.map((c) => ({ ...c, organisationId: org2.id })),
  ]) {
    const { familyCount, closedCount } = await seedCasesForUser(
      user,
      organisationId,
      subOrganisationId,
      fillableSingleForms,
      closingForm
    );
    console.log(`  ${user.email}: ${familyCount} families/cases, ${closedCount} closed`);
  }

  console.log('Creating general form responses...');
  const generalFormUsers = [
    ...org1Users.caseWorkers.map((c) => c.user),
    ...org2Users.caseWorkers.map((c) => c.user),
    org1Users.orgController,
    org2Users.orgController,
  ];
  for (const user of generalFormUsers) {
    await addGeneralFormResponses(user.id, generalForms);
  }

  console.log('\nSeeding finished. Dev login credentials (password: "12345"):');
  const allUsers = [
    controller,
    org1Users.orgController,
    org1Users.orgCoordinator,
    ...org1Users.subOrgCoordinators,
    ...org1Users.caseWorkers.map((c) => c.user),
    org2Users.orgController,
    org2Users.orgCoordinator,
    ...org2Users.subOrgCoordinators,
    ...org2Users.caseWorkers.map((c) => c.user),
  ];
  for (const u of allUsers) {
    console.log(`  - ${u.email}  (${u.role})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
