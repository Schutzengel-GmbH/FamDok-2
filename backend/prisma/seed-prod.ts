/**
 * Production seed script.
 *
 * Sets up the minimum required to administer a fresh instance: an organisation, the admin user
 * (+ matching Keycloak account), and every case/general form definition from
 * shared/definitions (except the example files) - optionally setting one of them as the
 * closing_doc.
 *
 * Configuration is read from prisma/seed-prod.config.json - copy
 * prisma/seed-prod.config.example.json to create it and fill in real values. That file is
 * gitignored since it's one-time instance setup (admin email, org name), not something to
 * commit.
 *
 * Safe to run against an already-seeded instance - it only creates the organisation/admin/forms
 * that don't already exist. Does not set a Keycloak password for the admin user; set the
 * initial password via the Keycloak admin console (or a required action) after seeding.
 *
 * Usage: npm run seed:prod (from backend/, or from the repo root)
 */
import fs from 'node:fs';
import path from 'node:path';
import * as z from 'zod';
import '../../shared/sharedGlobals';
import { prisma } from '../db';
import getAdminClient from '../kcAdminClient';
import { KC_REALM } from '../config';
import { Role } from '../../shared/generated/prisma/client';
import {
  seedCaseForms,
  seedGeneralForms,
  setClosingDocSetting,
} from './seedFormDefinitions';

const CONFIG_PATH = path.resolve(__dirname, 'seed-prod.config.json');

const ConfigSchema = z.object({
  organisationName: z.string().min(1),
  admin: z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  }),
  closingDocFormName: z.string().min(1).optional(),
});

type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `Missing ${CONFIG_PATH} - copy seed-prod.config.example.json to seed-prod.config.json ` +
        'and fill in real values.'
    );
  }

  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const result = ConfigSchema.safeParse(JSON.parse(raw));
  if (!result.success) {
    throw new Error(`Invalid seed-prod.config.json: ${result.error.message}`);
  }

  return result.data;
}

async function seedOrganisation(name: string) {
  const existing = await prisma.organisation.findFirst({ where: { name } });
  if (existing) {
    console.log(`  organisation "${existing.name}" already exists, skipping`);
    return existing;
  }

  const org = await prisma.organisation.create({ data: { name } });
  console.log(`  created organisation "${org.name}"`);
  return org;
}

async function seedAdmin(admin: Config['admin'], organisationId: string) {
  const adminClient = await getAdminClient();

  const existingKcUsers = await adminClient.users.find({
    email: admin.email,
    realm: KC_REALM,
    exact: true,
  });

  let kcId: string;
  if (existingKcUsers[0]?.id) {
    kcId = existingKcUsers[0].id;
  } else {
    const created = await adminClient.users.create({
      realm: KC_REALM,
      username: admin.email,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      enabled: true,
      emailVerified: true,
    });
    kcId = created.id;
    console.log(`  created Keycloak user "${admin.email}"`);
  }

  const existing = await prisma.user.findUnique({ where: { kcId } });
  if (existing) {
    console.log(`  admin user "${admin.email}" already exists, skipping`);
    return existing;
  }

  const user = await prisma.user.create({
    data: {
      kcId,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: Role.Admin,
      organisationId,
    },
  });
  console.log(`  created admin user "${user.email}"`);
  return user;
}

async function main() {
  console.log('Seeding prod instance...');
  const config = loadConfig();

  console.log('Creating organisation...');
  const org = await seedOrganisation(config.organisationName);

  console.log('Creating admin user (Postgres + Keycloak)...');
  await seedAdmin(config.admin, org.id);

  console.log('Creating form definitions...');
  const caseForms = await seedCaseForms();
  await seedGeneralForms();

  console.log('Configuring closing doc setting...');
  await setClosingDocSetting(caseForms, config.closingDocFormName);

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
