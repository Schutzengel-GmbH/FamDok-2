/**
 * Test server seed script.
 *
 * A smaller variant of seed-dev.ts (whose helpers it reuses) for the shared test server: all
 * case/general form definitions, the "Abschlussdokumentation" closing-doc setting, one
 * organisation ("Testorganisation") with 2 suborganisations, a few families/cases per case
 * worker and these users (email `<username>@dev.local`), all with the password "FamDok20":
 *   - `controller`         (Controller)
 *   - `orgcontroller`      (OrgController)
 *   - `orgcoordinator`     (OrgCoordinator)
 *   - `suborgcoordinator`  (SubOrgCoordinator, Sub 1)
 *   - `user1`, `user2`     (User, Sub 1)
 *   - `user3`              (User, Sub 2 - so suborg scoping has a case the coordinator can't see)
 *
 * Assumes the Postgres database and Keycloak are already running and reachable via the usual
 * .env configuration. Existing Keycloak users with these usernames are reused and get their
 * password reset; if the organisation or any of these users already exist in the database the
 * script aborts before changing anything, so it won't create duplicates on a second run.
 *
 * Usage: npm run seed:test (from backend/)
 */
import '../../shared/sharedGlobals';
import { prisma } from '../db';
import getAdminClient from '../kcAdminClient';
import { Role } from '../../shared/generated/prisma/client';
import {
  addGeneralFormResponses,
  CASE_WORKER_JOB_TITLES,
  createUser,
  randomInt,
  randomPersonName,
  seedCasesForUser,
  SeedUserDef,
} from './seed-dev';
import {
  seedCaseForms,
  seedGeneralForms,
  setClosingDocSetting,
} from './seedFormDefinitions';

const TEST_PASSWORD = 'FamDok20';
const ORG_NAME = 'Testorganisation';
const USERNAMES = [
  'controller',
  'orgcontroller',
  'orgcoordinator',
  'suborgcoordinator',
  'user1',
  'user2',
  'user3',
];

async function assertNotSeeded() {
  const org = await prisma.organisation.findFirst({ where: { name: ORG_NAME } });
  if (org)
    throw new Error(
      `Organisation "${ORG_NAME}" already exists - this seed script looks like it already ran ` +
        'against this database. Aborting to avoid creating duplicate test data.'
    );

  const users = await prisma.user.findMany({
    where: { email: { in: USERNAMES.map((u) => `${u}@dev.local`) } },
  });
  if (users.length > 0)
    throw new Error(
      `Users already exist: ${users.map((u) => u.email).join(', ')} - aborting.`
    );
}

async function main() {
  console.log('Seeding test server...');
  await assertNotSeeded();

  console.log('Creating form definitions...');
  const caseForms = await seedCaseForms();
  const generalForms = await seedGeneralForms();

  console.log('Configuring closing doc setting...');
  const closingForm = await setClosingDocSetting(caseForms, 'Abschlussdokumentation');
  if (!closingForm) throw new Error('Failed to set closing_doc setting');
  const fillableSingleForms = caseForms.filter(
    (f) => f.type === 'single' && f.id !== closingForm.id
  );

  console.log('Creating organisation...');
  const org = await prisma.organisation.create({ data: { name: ORG_NAME } });
  const sub1 = await prisma.subOrganisation.create({
    data: { name: `${ORG_NAME} - Sub 1`, organisationId: org.id },
  });
  const sub2 = await prisma.subOrganisation.create({
    data: { name: `${ORG_NAME} - Sub 2`, organisationId: org.id },
  });

  console.log('Creating users (Postgres + Keycloak)...');
  const adminClient = await getAdminClient();
  const create = (def: Omit<SeedUserDef, 'firstName' | 'lastName' | 'password'>) =>
    createUser(
      adminClient,
      { ...randomPersonName(), ...def, password: TEST_PASSWORD },
      org.id
    );

  const users = [
    await create({ username: 'controller', role: Role.Controller, jobTitle: 'Jugendamt' }),
    await create({
      username: 'orgcontroller',
      role: Role.OrgController,
      jobTitle: 'Leitung Frühe Hilfen',
    }),
    await create({
      username: 'orgcoordinator',
      role: Role.OrgCoordinator,
      jobTitle: 'Koordination Frühe Hilfen',
    }),
    await create({
      username: 'suborgcoordinator',
      role: Role.SubOrgCoordinator,
      jobTitle: 'Koordination Frühe Hilfen',
      subOrganisationIds: [sub1.id],
    }),
  ];

  const caseWorkers = [];
  for (const [i, subOrg] of [sub1, sub1, sub2].entries()) {
    const user = await create({
      username: `user${i + 1}`,
      role: Role.User,
      jobTitle: CASE_WORKER_JOB_TITLES[i],
      subOrganisationIds: [subOrg.id],
    });
    caseWorkers.push({ user, subOrganisationId: subOrg.id });
    users.push(user);
  }

  console.log('Creating families, cases and documentation...');
  for (const { user, subOrganisationId } of caseWorkers) {
    const { familyCount, closedCount } = await seedCasesForUser(
      user,
      org.id,
      subOrganisationId,
      fillableSingleForms,
      closingForm,
      randomInt(3, 5)
    );
    console.log(`  ${user.email}: ${familyCount} families/cases, ${closedCount} closed`);
  }

  console.log('Creating general form responses...');
  for (const { user } of caseWorkers) {
    await addGeneralFormResponses(user.id, generalForms);
  }

  console.log(`\nSeeding finished. Test login credentials (password: "${TEST_PASSWORD}"):`);
  for (const u of users) {
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
