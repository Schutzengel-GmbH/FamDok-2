import { prisma } from '../db';
import { BadRequestError } from './authUtils';
import {
  ANSWER_VALUE_FIELDS,
  BLOB_FIELDS,
  BlobModel,
  ENCRYPTED_COLUMNS,
  EncryptedModel,
} from '../../shared/utils/encryptedModels';
import { envelopeKeyVersion, isEnvelope } from '../../shared/utils/ciphertext';

/**
 * Server-side half of the org encryption: the server can't read personal data, but it can make
 * sure that once an organisation has set up its keys, the encrypted columns only ever receive
 * well-formed ciphertext under the current key version, and that rows holding ciphertext carry
 * the id the browser bound the ciphertext to.
 */

/** What a write into an organisation's data has to look like. */
export type EncryptionPolicy = {
  /** True once the org has set up its keys; until then plaintext is accepted (legacy mode). */
  active: boolean;
  /** The only key version new ciphertext may use. */
  keyVersion: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads the policy of an organisation. An org that doesn't exist or has no keys yet is in
 * legacy mode. Frozen and rotating orgs never reach the data controllers (see orgFrozen.ts).
 */
export async function encryptionPolicyFor(
  organisationId: string | null | undefined
): Promise<EncryptionPolicy> {
  if (!organisationId) return { active: false, keyVersion: 0 };
  const org = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { keyState: true, keyVersion: true },
  });
  if (!org || org.keyState === 'uninitialized')
    return { active: false, keyVersion: 0 };
  return { active: true, keyVersion: org.keyVersion };
}

/** Throws unless `value` is null/undefined or an envelope under the policy's key version. */
function assertEnvelope(
  policy: EncryptionPolicy,
  value: unknown,
  what: string
) {
  if (value === undefined || value === null) return;
  if (!isEnvelope(value))
    throw new BadRequestError(`${what} must be encrypted`);
  if (envelopeKeyVersion(value) !== policy.keyVersion)
    throw new BadRequestError(`${what} uses an outdated key version`);
}

/**
 * Checks the columns of a field-encrypted model in a write. Active orgs: each present value must
 * be ciphertext. Legacy orgs: ciphertext is refused, since nobody holds a key to read it.
 */
export function assertFieldWrite(
  policy: EncryptionPolicy,
  model: Exclude<EncryptedModel, BlobModel | 'Answer'>,
  data: Record<string, unknown>
) {
  for (const column of ENCRYPTED_COLUMNS[model]) {
    const value = data[column];
    if (policy.active) assertEnvelope(policy, value, `${model}.${column}`);
    else if (isEnvelope(value))
      throw new BadRequestError(
        `${model}.${column}: encryption is not set up for this organisation`
      );
  }
}

/**
 * Checks a write of a blob model (Family, Child, Caregiver). Active orgs: `encrypted` must be
 * present (when `requireBlob`) and no plaintext personal field may be sent. Legacy orgs: no
 * `encrypted` blob may be sent.
 */
export function assertBlobWrite(
  policy: EncryptionPolicy,
  model: BlobModel,
  data: Record<string, unknown>,
  requireBlob: boolean
) {
  if (!policy.active) {
    if (data['encrypted'] !== undefined && data['encrypted'] !== null)
      throw new BadRequestError(
        `${model}: encryption is not set up for this organisation`
      );
    return;
  }

  for (const field of BLOB_FIELDS[model]) {
    const value = data[field];
    const empty =
      value === undefined ||
      value === null ||
      (Array.isArray(value) && value.length === 0);
    if (!empty)
      throw new BadRequestError(
        `${model}.${field} must be sent encrypted, not in plaintext`
      );
  }
  if (requireBlob && (data['encrypted'] === undefined || data['encrypted'] === null))
    throw new BadRequestError(`${model}: encrypted data is missing`);
  assertEnvelope(policy, data['encrypted'], `${model}.encrypted`);
}

/**
 * Checks the answers of a form response. For forms with personal data in active orgs, values
 * must come in `answerEncrypted` and the typed columns stay empty; everywhere else
 * `answerEncrypted` is refused.
 */
export function assertAnswersWrite(
  policy: EncryptionPolicy,
  personal: boolean,
  answers: Record<string, unknown>[]
) {
  for (const answer of answers) {
    if (policy.active && personal) {
      for (const field of ANSWER_VALUE_FIELDS) {
        const value = answer[field];
        const empty =
          value === undefined ||
          value === null ||
          (Array.isArray(value) && value.length === 0);
        if (!empty)
          throw new BadRequestError(
            `Answer.${field} must be sent encrypted for forms with personal data`
          );
      }
      assertEnvelope(policy, answer['answerEncrypted'], 'Answer.answerEncrypted');
    } else if (
      answer['answerEncrypted'] !== undefined &&
      answer['answerEncrypted'] !== null
    ) {
      throw new BadRequestError(
        'Answer.answerEncrypted is only accepted for forms with personal data of encrypted organisations'
      );
    }
  }
}

/**
 * Checks the id a browser chose for a new row. Ciphertext is bound to the row id, so in active
 * orgs the browser must pick it (a UUID); in legacy orgs the database still generates it.
 */
export function assertClientId(
  policy: EncryptionPolicy,
  id: unknown,
  model: string
) {
  if (id === undefined || id === null) {
    if (policy.active)
      throw new BadRequestError(`${model}: id is required for encrypted rows`);
    return;
  }
  if (typeof id !== 'string' || !UUID.test(id))
    throw new BadRequestError(`${model}: id must be a UUID`);
}
