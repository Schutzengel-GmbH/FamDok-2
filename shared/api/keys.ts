import * as z from "zod";
import {
  isEnvelope,
  isGrant,
  isP256PublicKey,
  isRecoveryWrappedKey,
  isWrappedPrivKey,
} from "../utils/ciphertext";
import { ENCRYPTED_COLUMNS, EncryptedModel } from "../utils/encryptedModels";
import { Wire } from "./common";

/**
 * Requests and responses of the `/keys` routes: enrolment, grants, the key log, freezing,
 * rotation and the migration of existing plaintext data. The server only ever receives public
 * keys, wrapped keys and ciphertext here; every schema checks the format so nothing else can be
 * stored in their place.
 */

const PublicKey = z
  .string()
  .refine(isP256PublicKey, "must be a base64url P-256 SPKI public key");
const WrappedPrivateKey = z
  .string()
  .refine(isWrappedPrivKey, "must be a k1. wrapped private key");
const Grant = z.string().refine(isGrant, "must be a g1. grant");
const RecoveryWrappedKey = z
  .string()
  .refine(isRecoveryWrappedKey, "must be an r1. recovery-wrapped key");
const Envelope = z.string().refine(isEnvelope, "must be a v1. envelope");
const KeyVersion = z.number().int().min(1).max(999_999_999);

/** Bounds match `validateKdfParams` in the frontend, so the server never stores what it rejects. */
export const KdfParamsSchema = z.strictObject({
  alg: z.literal("argon2id"),
  salt: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  memoryKiB: z.number().int().min(8).max(1_000_000),
  iterations: z.number().int().min(1).max(10),
  parallelism: z.literal(1),
});
export type KdfParamsWire = z.infer<typeof KdfParamsSchema>;

/** Body of `PUT /keys/me`: first enrolment, or with `replace` a new key pair (re-enrolment). */
export const UserKeyRequest = z.strictObject({
  publicKey: PublicKey,
  wrappedPrivateKey: WrappedPrivateKey,
  kdfParams: KdfParamsSchema,
  replace: z.boolean().optional(),
});
export type UserKeyRequest = Wire<typeof UserKeyRequest>;

/** Body of `PUT /keys/me/passphrase`: the same private key, wrapped under a new passphrase. */
export const PassphraseChangeRequest = z.strictObject({
  wrappedPrivateKey: WrappedPrivateKey,
  kdfParams: KdfParamsSchema,
});
export type PassphraseChangeRequest = Wire<typeof PassphraseChangeRequest>;

/** Body of `POST /keys/orgs/:orgId/setup`: the first coordinator's self-grant for version 1. */
export const OrgSetupRequest = z.strictObject({
  grant: Grant,
  recoveryWrappedKey: RecoveryWrappedKey,
});
export type OrgSetupRequest = Wire<typeof OrgSetupRequest>;

/**
 * Body of `POST /keys/orgs/:orgId/grants`. `publicKey` names the key the grant was sealed to, so
 * a grant for a key pair the user has since replaced is refused.
 */
export const GrantRequest = z.strictObject({
  userId: z.string().min(1),
  keyVersion: KeyVersion,
  wrappedKey: Grant,
  publicKey: PublicKey,
});
export type GrantRequest = Wire<typeof GrantRequest>;

/** Body of `POST /keys/orgs/:orgId/rotation/start`: the new version and the coordinator's grant. */
export const RotationStartRequest = z.strictObject({
  keyVersion: KeyVersion,
  grant: Grant,
});
export type RotationStartRequest = Wire<typeof RotationStartRequest>;

/** Body of `POST /keys/orgs/:orgId/rotation/complete`: grants for everyone, new recovery key. */
export const RotationCompleteRequest = z.strictObject({
  grants: z.array(
    z.strictObject({
      userId: z.string().min(1),
      wrappedKey: Grant,
      publicKey: PublicKey,
    }),
  ),
  recoveryWrappedKey: RecoveryWrappedKey,
});
export type RotationCompleteRequest = Wire<typeof RotationCompleteRequest>;

const ModelName = z.enum(
  Object.keys(ENCRYPTED_COLUMNS) as [EncryptedModel, ...EncryptedModel[]],
);

/** Query of the rotation and migration row lists. */
export const ReencryptRowsQuery = z.strictObject({
  model: ModelName,
  take: z.number().int().min(1).max(500).optional(),
});
export type ReencryptRowsQuery = Wire<typeof ReencryptRowsQuery>;

/**
 * Body of the rotation and migration row updates: new ciphertext per row, keyed by column. A
 * value of `null` stands for an empty plaintext.
 */
export const ReencryptRowsRequest = z.strictObject({
  model: ModelName,
  rows: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        values: z.record(z.string(), Envelope.nullable()),
      }),
    )
    .max(500),
});
export type ReencryptRowsRequest = Wire<typeof ReencryptRowsRequest>;

/** Query of `PUT /keys/orgs/:orgId/attachments/:id/content` next to the raw body. */
export const AttachmentContentQuery = z.strictObject({
  keyVersion: KeyVersion,
});
export type AttachmentContentQuery = Wire<typeof AttachmentContentQuery>;

/** Response of `GET /keys/me`: everything a browser needs to unlock. */
export type KeyStatus = {
  org: {
    id: string;
    name: string;
    keyState: "uninitialized" | "active" | "frozen" | "rotating";
    keyVersion: number;
    pendingKeyVersion: number | null;
    frozenAt: Date | null;
  } | null;
  userKey: {
    publicKey: string;
    wrappedPrivateKey: string;
    kdfParams: KdfParamsWire;
  } | null;
  /** The user's grants for the current and, during a rotation, the pending key version. */
  grants: { keyVersion: number; wrappedKey: string; publicKey: string }[];
  /** Whether this user may manage the org's keys (OrgCoordinator of the org). */
  canManageKeys: boolean;
  /** Whether this user's role reads personal data and therefore needs keys at all. */
  needsKeys: boolean;
};

/** One org member as the coordinator's key management page shows them. */
export type OrgKeyMember = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  /** Present once the user has enrolled. The browser recomputes the fingerprint from it. */
  publicKey: string | null;
  enrolledAt: Date | null;
  /** Grant for the current key version, if any, and the key it was sealed to. */
  grant: { keyVersion: number; publicKey: string; createdAt: Date; grantedById: string | null } | null;
  /** Whether the role works with personal data and should get a grant. */
  needsKeys: boolean;
};

/** One entry of the org's key log. */
export type OrgKeyEventView = {
  id: string;
  type: string;
  createdAt: Date;
  keyVersion: number | null;
  fingerprint: string | null;
  actor: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
  subject: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
};

/** Response of the migration status: how many rows per model still hold plaintext. */
export type MigrationStatus = {
  rows: Record<EncryptedModel, number>;
  attachmentContents: number;
};

/** Response of the rotation status: how many rows per model are not yet at the pending version. */
export type RotationStatus = MigrationStatus;
