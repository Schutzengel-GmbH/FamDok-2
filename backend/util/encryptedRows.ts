import { prisma } from '../db';
import { BadRequestError } from './authUtils';
import {
  ANSWER_VALUE_FIELDS,
  BLOB_FIELDS,
  ENCRYPTED_COLUMNS,
  EncryptedModel,
  clearedAnswerFields,
  clearedBlobFields,
  isBlobModel,
} from '../../shared/utils/encryptedModels';
import { envelopeKeyVersion } from '../../shared/utils/ciphertext';

/**
 * Finding and rewriting encrypted rows of one organisation, for the two bulk jobs a
 * coordinator's browser runs: rotation (re-encrypt every envelope to the pending key version)
 * and migration (encrypt rows that still hold plaintext). The server only selects and stores;
 * all decryption and encryption happens in the browser.
 */

/** Which of the two bulk jobs a request belongs to. */
export type ReencryptMode = 'rotation' | 'migration';

type Where = Record<string, unknown>;

/** The Prisma delegate of a model, typed loosely: the selectors below are model-generic. */
function delegate(model: EncryptedModel): any {
  const name = model[0].toLowerCase() + model.slice(1);
  return (prisma as any)[name];
}

/** Restricts a model's rows to those of one organisation. */
export function orgScope(model: EncryptedModel, orgId: string): Where {
  switch (model) {
    case 'Family':
    case 'Case':
      return { organisationId: orgId };
    case 'Child':
    case 'Caregiver':
      return { family: { organisationId: orgId } };
    case 'ContactDocumentation':
    case 'Zielvereinbarung':
    case 'Handover':
    case 'CaseAttachment':
      return { case: { organisationId: orgId } };
    case 'Answer':
      return { caseFormResponse: { case: { organisationId: orgId } } };
  }
}

/** Rows holding at least one envelope that isn't under `version` yet. */
function notAtVersion(model: EncryptedModel, version: number): Where {
  return {
    OR: ENCRYPTED_COLUMNS[model].map((column) => ({
      [column]: { startsWith: 'v1.', not: { startsWith: `v1.${version}.` } },
    })),
  };
}

/**
 * A column that holds plaintext: not an envelope. SQL's three-valued logic makes
 * `NOT (col LIKE 'v1.%')` false for NULL, so empty columns are excluded as well.
 */
function plaintextColumn(column: string): Where {
  return { NOT: { [column]: { startsWith: 'v1.' } } };
}

/** Rows that still hold plaintext personal data. */
function holdsPlaintext(model: EncryptedModel): Where {
  if (isBlobModel(model)) return { encrypted: null, name: { not: null } };
  if (model === 'Answer')
    return {
      answerEncrypted: null,
      caseFormResponse: { caseForm: { containsPersonalData: true } },
      OR: [
        { answerText: { not: null } },
        { answerNum: { not: null } },
        { answerInt: { not: null } },
        { answerDate: { not: null } },
        { answerBool: { not: null } },
        { answerSelectId: { isEmpty: false } },
      ],
    };
  return { OR: ENCRYPTED_COLUMNS[model].map(plaintextColumn) };
}

/** What a job still has to process for `model` in `orgId`. */
function pendingWhere(
  mode: ReencryptMode,
  model: EncryptedModel,
  orgId: string,
  version: number
): Where {
  return {
    AND: [
      orgScope(model, orgId),
      mode === 'rotation' ? notAtVersion(model, version) : holdsPlaintext(model),
    ],
  };
}

/** The columns a job hands to the browser: ciphertext for rotation, plaintext for migration. */
function selectFor(mode: ReencryptMode, model: EncryptedModel) {
  const columns: string[] =
    mode === 'migration' && isBlobModel(model)
      ? [...BLOB_FIELDS[model]]
      : mode === 'migration' && model === 'Answer'
        ? [...ANSWER_VALUE_FIELDS]
        : [...ENCRYPTED_COLUMNS[model]];
  return Object.fromEntries([['id', true], ...columns.map((c) => [c, true])]);
}

/** Counts the rows per model a job still has to process. */
export async function countPending(
  mode: ReencryptMode,
  orgId: string,
  version: number
): Promise<Record<EncryptedModel, number>> {
  const models = Object.keys(ENCRYPTED_COLUMNS) as EncryptedModel[];
  const counts = await Promise.all(
    models.map((m) => delegate(m).count({ where: pendingWhere(mode, m, orgId, version) }))
  );
  return Object.fromEntries(models.map((m, i) => [m, counts[i] as number])) as Record<
    EncryptedModel,
    number
  >;
}

/** The next batch of rows a job has to process for `model`. */
export async function findPending(
  mode: ReencryptMode,
  model: EncryptedModel,
  orgId: string,
  version: number,
  take = 100
): Promise<Record<string, unknown>[]> {
  return delegate(model).findMany({
    where: pendingWhere(mode, model, orgId, version),
    select: selectFor(mode, model),
    orderBy: { id: 'asc' },
    take,
  });
}

/**
 * Stores re-encrypted values. Every value must be an envelope under `version` (or null), only
 * encrypted columns are written, and only rows of `orgId` that still need the job are touched,
 * so a row edited meanwhile isn't overwritten with older content. Returns how many rows changed.
 */
export async function storeReencrypted(
  mode: ReencryptMode,
  model: EncryptedModel,
  orgId: string,
  version: number,
  rows: { id: string; values: Record<string, string | null> }[]
): Promise<number> {
  const allowed = new Set<string>(ENCRYPTED_COLUMNS[model]);
  let changed = 0;

  for (const { id, values } of rows) {
    for (const [column, value] of Object.entries(values)) {
      if (!allowed.has(column))
        throw new BadRequestError(`${model}.${column} is not an encrypted column`);
      if (value !== null && envelopeKeyVersion(value) !== version)
        throw new BadRequestError(`${model}.${column} must use key version ${version}`);
    }
    if (isBlobModel(model) && !values['encrypted'])
      throw new BadRequestError(`${model}.encrypted is required`);

    const data: Record<string, unknown> = { ...values };
    if (mode === 'migration' && isBlobModel(model))
      Object.assign(data, clearedBlobFields(model));
    if (mode === 'migration' && model === 'Answer')
      Object.assign(data, clearedAnswerFields());

    const result = await delegate(model).updateMany({
      where: { AND: [{ id }, pendingWhere(mode, model, orgId, version)] },
      data,
    });
    changed += result.count;
  }
  return changed;
}
