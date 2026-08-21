/**
 * Shared form-definition seeding logic, used by both seed-dev.ts and seed-prod.ts: creates
 * every case/general form definition from shared/definitions (skipping example files and forms
 * that already exist by name), and can set the `closing_doc` setting to one of them by name.
 */
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../db';
import { parseCaseForm, parseGeneralForm } from '../../shared/utils/parseForm';

const CASEFORM_DEFINITIONS_DIR = path.resolve(
  __dirname,
  '../../shared/definitions/caseForms'
);
const GENERALFORM_DEFINITIONS_DIR = path.resolve(
  __dirname,
  '../../shared/definitions/generalForms'
);

export async function seedCaseForms() {
  const files = fs
    .readdirSync(CASEFORM_DEFINITIONS_DIR)
    .filter((f) => f.endsWith('.json') && !f.toLowerCase().includes('example'));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(CASEFORM_DEFINITIONS_DIR, file), 'utf8');
    const name = (JSON.parse(raw) as { name: string }).name;

    const existing = await prisma.caseForm.findFirst({ where: { name } });
    if (existing) {
      console.log(`  caseForm "${name}" already exists, skipping`);
      continue;
    }

    await prisma.caseForm.create({ data: parseCaseForm(raw) });
    console.log(`  created caseForm "${name}"`);
  }

  return prisma.caseForm.findMany({
    include: { questions: { orderBy: { order: 'asc' } } },
  });
}

export async function seedGeneralForms() {
  const files = fs
    .readdirSync(GENERALFORM_DEFINITIONS_DIR)
    .filter((f) => f.endsWith('.json') && !f.toLowerCase().includes('example'));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(GENERALFORM_DEFINITIONS_DIR, file), 'utf8');
    const name = (JSON.parse(raw) as { name: string }).name;

    const existing = await prisma.generalForm.findFirst({ where: { name } });
    if (existing) {
      console.log(`  generalForm "${name}" already exists, skipping`);
      continue;
    }

    await prisma.generalForm.create({ data: parseGeneralForm(raw) });
    console.log(`  created generalForm "${name}"`);
  }

  return prisma.generalForm.findMany({
    include: { questions: { orderBy: { order: 'asc' } } },
  });
}

/**
 * Sets the `closing_doc` setting to the case form named `closingDocFormName`, if given - a
 * no-op if no name is given, since the closing doc is optional. Throws if a name is given but
 * doesn't match any of `caseForms` (a config error, not something to silently ignore).
 */
export async function setClosingDocSetting(
  caseForms: Awaited<ReturnType<typeof seedCaseForms>>,
  closingDocFormName?: string
) {
  if (!closingDocFormName) {
    console.log('  no closing_doc form name given, skipping');
    return undefined;
  }

  const closingForm = caseForms.find((f) => f.name === closingDocFormName);
  if (!closingForm)
    throw new Error(
      `Could not find a "${closingDocFormName}" case form definition to use as the closing doc`
    );

  await prisma.setting.upsert({
    where: { name: 'closing_doc' },
    update: { value: closingForm.id },
    create: { name: 'closing_doc', value: closingForm.id },
  });
  console.log(`  set closing_doc setting -> "${closingForm.name}" (${closingForm.id})`);

  return closingForm;
}
