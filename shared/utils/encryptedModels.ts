/**
 * The single list of what the org encryption covers. The frontend uses it to encrypt and decrypt,
 * the backend to check that these columns only ever receive ciphertext once an organisation has
 * set up its keys, and rotation and migration to find every value they have to rewrite.
 *
 * Two kinds of storage:
 * - Field: an existing `String` column holds a `v1.` envelope of the plaintext string.
 * - Blob: a new `encrypted` column holds one envelope of all listed fields as SuperJSON, and the
 *   former plaintext columns stay empty (and are dropped by the follow-up migration).
 */

/** Models whose personal data is encrypted, and the columns that hold ciphertext. */
export const ENCRYPTED_COLUMNS = {
  Family: ["encrypted"],
  Child: ["encrypted"],
  Caregiver: ["encrypted"],
  Case: ["specificMigrationBackground"],
  ContactDocumentation: ["zusammenfassung", "dokumentation"],
  Zielvereinbarung: ["description"],
  Handover: ["notes"],
  CaseAttachment: ["filename", "note"],
  Answer: ["answerEncrypted"],
} as const;

export type EncryptedModel = keyof typeof ENCRYPTED_COLUMNS;
export type EncryptedColumn<M extends EncryptedModel> =
  (typeof ENCRYPTED_COLUMNS)[M][number];

/** For blob models: the former plaintext columns that now live inside `encrypted`. */
export const BLOB_FIELDS = {
  Family: ["name", "note", "adress", "phone", "additionalPhones"],
  Child: ["name", "lastName", "gender", "dateOfBirth", "healthData"],
  Caregiver: ["name", "lastName", "gender", "dateOfBirth", "relation"],
} as const;

export type BlobModel = keyof typeof BLOB_FIELDS;

/** For personal-form answers: the typed answer columns that now live inside `answerEncrypted`. */
export const ANSWER_VALUE_FIELDS = [
  "answerBool",
  "answerDate",
  "answerInt",
  "answerNum",
  "answerSelectId",
  "answerText",
] as const;

/** Whether `model` keeps its personal fields in one encrypted blob. */
export function isBlobModel(model: string): model is BlobModel {
  return model in BLOB_FIELDS;
}

/**
 * Empty values for the plaintext columns of a blob model, written whenever its blob is. Keeps
 * a row from carrying both forms, e.g. after migrating it or when an old client sends both.
 */
export function clearedBlobFields(model: BlobModel): Record<string, unknown> {
  const cleared: Record<string, unknown> = {};
  for (const f of BLOB_FIELDS[model]) cleared[f] = null;
  if (model === "Family") cleared["additionalPhones"] = [];
  if (model === "Child") cleared["healthData"] = [];
  return cleared;
}

/** Empty values for the typed columns of an encrypted answer. */
export function clearedAnswerFields(): Record<string, unknown> {
  return {
    answerBool: null,
    answerDate: null,
    answerInt: null,
    answerNum: null,
    answerSelectId: [],
    answerText: null,
  };
}

/** Lifecycle of an organisation's encryption, mirrored by the Prisma enum `OrgKeyState`. */
export const ORG_KEY_STATES = [
  "uninitialized",
  "active",
  "frozen",
  "rotating",
] as const;
export type OrgKeyStateName = (typeof ORG_KEY_STATES)[number];

/**
 * Roles that hold the org data key: those that read and write personal data, and OrgControllers,
 * who manage the keys (granting the key requires holding it).
 */
export const ROLES_NEEDING_KEYS = [
  "User",
  "OrgCoordinator",
  "SubOrgCoordinator",
  "OrgController",
] as const;

/**
 * Roles that may grant the org data key, freeze the org and run a rotation. An OrgController
 * could use the key to read data the application otherwise doesn't show them; that is accepted,
 * since the encryption protects the data from the operator, not within the organisation.
 */
export const KEY_MANAGER_ROLES = ["OrgCoordinator", "OrgController"] as const;

/** The row data an encryption context is built from. */
export type ContextRow = {
  id: string;
  caseFormResponseId?: string | null;
  questionId?: string;
};

/**
 * The AES-GCM context of an encrypted column: `<model>:<row id>:<column>`. Answers are the one
 * exception: they are bound to their response and question (`Answer:<response id>:<question
 * id>`), so a value can't be moved to another question and the browser never needs to choose
 * ids for answer rows. Used for writing, reading, rotation and migration alike.
 */
export function encryptionContext(
  model: EncryptedModel,
  row: ContextRow,
  column: string,
): { table: string; rowId: string; field: string } {
  if (model === "Answer") {
    if (!row.caseFormResponseId || !row.questionId)
      throw new Error("Answer context needs caseFormResponseId and questionId");
    return { table: "Answer", rowId: row.caseFormResponseId, field: row.questionId };
  }
  return { table: model, rowId: row.id, field: column };
}

/** Context of an attachment's file content. */
export function attachmentContentContext(id: string) {
  return { table: "CaseAttachment", rowId: id, field: "content" };
}

/**
 * Encryption context of the continuity proof of key version `keyVersion`: the fingerprint of
 * that version's key, encrypted under the previous version (see `OrgKeyProof`).
 */
export function keyProofContext(orgId: string, keyVersion: number) {
  return { table: "OrgKey", rowId: orgId, field: `v${keyVersion}` };
}
