/**
 * Formats and helpers for everything the org encryption stores as text: field envelopes
 * (`v1.`), wrapped private keys (`k1.`), key grants (`g1.`) and recovery-wrapped keys (`r1.`),
 * plus the binary envelope used for attachment contents. Shared by frontend and backend, so the
 * server can check that encrypted columns only ever receive well-formed ciphertext.
 */

/** Thrown when a string or byte sequence is not in the expected ciphertext format. */
export class CiphertextFormatError extends Error {
  override name = "CiphertextFormatError";
}

const lookup =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** `v1.<keyVersion>.<iv: 12 bytes>.<ciphertext + 16 byte tag>`; key versions have at most 9 digits. */
const ENVELOPE_REGEX =
  /^v1\.(0|[1-9]\d{0,8})\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/;

/**
 * Encodes bytes as unpadded base64url (RFC 4648 §5), the encoding of every binary part of the
 * text formats in this file.
 */
export function toB64Url(bytes: Uint8Array): string {
  let output: string = "";
  let pos = 0;
  let done = false;

  do {
    // Take the next three elements or whatever is left
    const end = Math.min(pos + 3, bytes.length);
    const slice = bytes.slice(pos, end);

    // If one element is left, take the most significant 6 bits and the
    // zero-padded two most significant bits and append two padding characters
    if (slice.length === 1) {
      const i0 = slice[0] >> 2;
      const i1 = (slice[0] & 0b00000011) << 4;

      output = output.concat(lookup[i0], lookup[i1]);
    }

    // If two elements are left, take the most significant 6 bits of the first
    // element, glue the least significant two of the first and the most
    // significant four of the second element together and take the zero-padded
    // four least significant bits of the second element and append one padding
    // character
    if (slice.length === 2) {
      const i0 = slice[0] >> 2;
      const i1 =
        ((slice[0] & 0b00000011) << 4) | ((slice[1] & 0b11110000) >> 4);
      const i2 = (slice[1] & 0b00001111) << 2;

      output = output.concat(lookup[i0], lookup[i1], lookup[i2]);
    }

    // If there are three elements in the set to look at, spread the three
    // bytes fully to four six bit groups
    if (slice.length === 3) {
      const i0 = slice[0] >> 2;
      const i1 =
        ((slice[0] & 0b00000011) << 4) | ((slice[1] & 0b11110000) >> 4);
      const i2 =
        ((slice[1] & 0b00001111) << 2) | ((slice[2] & 0b11000000) >> 6);
      const i3 = slice[2] & 0b00111111;

      output = output.concat(lookup[i0], lookup[i1], lookup[i2], lookup[i3]);
    }

    pos += 3;
    done = end === bytes.length;
  } while (!done);

  return output;
}

/**
 * Decodes unpadded base64url. Throws {@link CiphertextFormatError} on characters outside the
 * alphabet and on lengths no byte sequence can encode to.
 */
export function fromB64Url(s: string): Uint8Array {
  // A base64 string must always conform to the character set
  if (!/^[A-Za-z0-9_-]*$/.test(s))
    throw new CiphertextFormatError("not a valid base64 string");
  // There is no padding, but a triplet can never result in one trailing char
  if (s.length % 4 === 1)
    throw new CiphertextFormatError("not a valid base64 string");

  let output = [] as number[];

  // take four characters at a time
  for (let i = 0; i < s.length; i += 4) {
    const end = i + 4;
    const slice = s.slice(i, end);

    // If there are two characters we take the (binary representation
    // of) the first character and the two most significant bits of the second.
    // The leftover should just be zero padding.
    if (slice.length === 2) {
      output.push(
        (lookup.indexOf(slice[0]) << 2) | (lookup.indexOf(slice[1]) >> 4),
      );
    }

    // If there are three character, we take the (binary representation
    // of) the first character and the two most significant bits of the second.
    // Then the four least significant bits of the second and the four most
    // significant from the third and finally the leftover should just be
    // zero padding.
    else if (slice.length === 3) {
      output.push(
        (lookup.indexOf(slice[0]) << 2) | (lookup.indexOf(slice[1]) >> 4),
      );
      output.push(
        ((lookup.indexOf(slice[1]) & 0b001111) << 4) |
          (lookup.indexOf(slice[2]) >> 2),
      );
    }

    // If there are four characters, we take the (binary representation
    // of) the first character, the two most significant bits of the second
    // the four least significant of the second and the four most significant
    // of the third and finally the two least significant og the third and
    // the fourth.
    else if (slice.length === 4) {
      output.push(
        (lookup.indexOf(slice[0]) << 2) | (lookup.indexOf(slice[1]) >> 4),
      );
      output.push(
        ((lookup.indexOf(slice[1]) & 0b001111) << 4) |
          (lookup.indexOf(slice[2]) >> 2),
      );
      output.push(
        ((lookup.indexOf(slice[2]) & 0b000011) << 6) | lookup.indexOf(slice[3]),
      );
    }
  }

  return new Uint8Array(output);
}

/**
 * Where an encrypted value lives. It becomes the AES-GCM additional data, so a ciphertext only
 * decrypts in the row and field it was written for.
 */
export type FieldContext = {
  table: string;
  rowId: string;
  field: string;
};

/** No part may be empty or contain `:`, so the joined AAD string is unambiguous. */
function validateFieldContext(ctx: FieldContext): boolean {
  return (
    ctx.table != "" &&
    ctx.field != "" &&
    ctx.rowId != "" &&
    !ctx.table.includes(":") &&
    !ctx.field.includes(":") &&
    !ctx.rowId.includes(":")
  );
}

/** Joins a {@link FieldContext} to `<table>:<rowId>:<field>`, the AES-GCM additional data. */
export function buildAad(ctx: FieldContext): string {
  if (!validateFieldContext(ctx))
    throw new CiphertextFormatError("bad FieldContext");
  const { table, rowId, field } = ctx;
  return `${table}:${rowId}:${field}`;
}

/** Builds a field envelope from its base64url parts, validating the result. */
export function formatEnvelope(
  keyVersion: number,
  iv: string,
  ct: string,
): string {
  const envelope = `v1.${keyVersion}.${iv}.${ct}`;
  if (!ENVELOPE_REGEX.test(envelope))
    throw new CiphertextFormatError("invalid envelope string");
  return envelope;
}

/** Splits a field envelope into key version, IV and ciphertext (still base64url). */
export function parseEnvelope(s: string): {
  keyVersion: number;
  iv: string;
  ct: string;
} {
  if (!isEnvelope(s))
    throw new CiphertextFormatError("invalid envelope string");
  const parts = s.split(".");
  return { keyVersion: parseInt(parts[1]), iv: parts[2], ct: parts[3] };
}

/** Whether `x` is a well-formed field envelope. */
export function isEnvelope(x: unknown): boolean {
  return typeof x === "string" && ENVELOPE_REGEX.test(x);
}

/** `k1.<iv: 12 bytes>.<wrapped PKCS#8 + tag>` */
const WRAPPED_PRIV_KEY_REGEX = /^k1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/;

/** Whether `x` is a well-formed wrapped private key (`k1.<iv>.<ct>`). */
export function isWrappedPrivKey(x: unknown): boolean {
  return typeof x === "string" && WRAPPED_PRIV_KEY_REGEX.test(x);
}

/** Builds a wrapped private key string from its base64url parts, validating the result. */
export function formatWrappedPrivateKey(iv: string, ct: string): string {
  const wrapped = `k1.${iv}.${ct}`;
  if (!isWrappedPrivKey(wrapped))
    throw new CiphertextFormatError("invalid key");
  return wrapped;
}

/** Splits a wrapped private key string into IV and ciphertext (still base64url). */
export function parseWrappedPrivateKey(s: string): { iv: string; ct: string } {
  if (!isWrappedPrivKey(s))
    throw new CiphertextFormatError("invalid wrapped key");

  const parts = s.split(".");
  return { iv: parts[1], ct: parts[2] };
}

/** Identifies the org data key a grant or recovery-wrapped key belongs to. */
export type OrgKeyContext = { orgId: string; keyVersion: number };

/** Throws unless `ctx` has a usable org id and a non-negative integer key version. */
function validateOrgKeyContext(ctx: OrgKeyContext) {
  if (!ctx.orgId || ctx.orgId.includes(":"))
    throw new CiphertextFormatError("bad orgId");
  if (!Number.isInteger(ctx.keyVersion) || ctx.keyVersion < 0)
    throw new CiphertextFormatError("bad keyVersion");
}

/**
 * The HPKE `info` of a grant: `famdok-grant-v1:<orgId>:<keyVersion>`. Binding the version means
 * a server can't hand out an old (possibly compromised) key labelled as the current one.
 */
export function buildGrantInfo(ctx: OrgKeyContext): string {
  validateOrgKeyContext(ctx);
  return `famdok-grant-v1:${ctx.orgId}:${ctx.keyVersion}`;
}

/** The AES-GCM additional data of a recovery-wrapped key, bound to org and key version. */
export function buildRecoveryAad(ctx: OrgKeyContext): string {
  validateOrgKeyContext(ctx);
  return `famdok-recovery-v1:${ctx.orgId}:${ctx.keyVersion}`;
}

/** `g1.<enc: 65 bytes>.<sealed 32-byte key + 16-byte tag>` */
const GRANT_REGEX = /^g1\.[A-Za-z0-9_-]{87}\.[A-Za-z0-9_-]{64}$/;

/** Whether `x` is a well-formed grant. */
export function isGrant(x: unknown): boolean {
  return typeof x === "string" && GRANT_REGEX.test(x);
}

/** Builds a grant string from the HPKE encapsulated secret and ciphertext (base64url). */
export function formatGrant(enc: string, ct: string): string {
  const grant = `g1.${enc}.${ct}`;
  if (!isGrant(grant)) throw new CiphertextFormatError("invalid grant");
  return grant;
}

/** Splits a grant into HPKE encapsulated secret and ciphertext (still base64url). */
export function parseGrant(s: string): { enc: string; ct: string } {
  if (!isGrant(s)) throw new CiphertextFormatError("invalid grant");
  const parts = s.split(".");
  return { enc: parts[1], ct: parts[2] };
}

/** `r1.<keyVersion>.<iv: 12 bytes>.<32-byte key + 16-byte tag>` */
const RECOVERY_REGEX =
  /^r1\.(0|[1-9]\d{0,8})\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$/;

/** Whether `x` is a well-formed recovery-wrapped key. */
export function isRecoveryWrappedKey(x: unknown): boolean {
  return typeof x === "string" && RECOVERY_REGEX.test(x);
}

/** Builds a recovery-wrapped key string, validating the result. */
export function formatRecoveryWrappedKey(
  keyVersion: number,
  iv: string,
  ct: string,
): string {
  const s = `r1.${keyVersion}.${iv}.${ct}`;
  if (!isRecoveryWrappedKey(s))
    throw new CiphertextFormatError("invalid recovery-wrapped key");
  return s;
}

/** Splits a recovery-wrapped key into key version, IV and ciphertext (still base64url). */
export function parseRecoveryWrappedKey(s: string): {
  keyVersion: number;
  iv: string;
  ct: string;
} {
  if (!isRecoveryWrappedKey(s))
    throw new CiphertextFormatError("invalid recovery-wrapped key");
  const parts = s.split(".");
  return { keyVersion: parseInt(parts[1]), iv: parts[2], ct: parts[3] };
}

/**
 * The key version of an envelope, or `undefined` if `x` isn't one. Lets the server find rows a
 * rotation still has to re-encrypt without being able to decrypt them.
 */
export function envelopeKeyVersion(x: unknown): number | undefined {
  if (!isEnvelope(x)) return undefined;
  return parseInt((x as string).split(".")[1]);
}

/** Magic bytes of an encrypted attachment: ASCII `FDK1`. */
const BYTES_MAGIC = [0x46, 0x44, 0x4b, 0x31];
/** Magic (4) + key version as big-endian uint32 (4) + IV (12). */
export const BYTES_HEADER_LENGTH = 20;

/**
 * Binary counterpart of a field envelope, for attachment contents:
 * `FDK1 | keyVersion (uint32 BE) | iv (12) | ciphertext + tag`.
 */
export function formatBytesEnvelope(
  keyVersion: number,
  iv: Uint8Array,
  ct: Uint8Array,
): Uint8Array {
  if (!Number.isInteger(keyVersion) || keyVersion < 0 || keyVersion > 0xffffffff)
    throw new CiphertextFormatError("bad keyVersion");
  if (iv.length !== 12) throw new CiphertextFormatError("bad iv");
  if (ct.length < 16) throw new CiphertextFormatError("ciphertext too short");
  const out = new Uint8Array(BYTES_HEADER_LENGTH + ct.length);
  out.set(BYTES_MAGIC, 0);
  new DataView(out.buffer).setUint32(4, keyVersion);
  out.set(iv, 8);
  out.set(ct, BYTES_HEADER_LENGTH);
  return out;
}

/** Whether `bytes` start like an encrypted attachment and are long enough to be one. */
export function isBytesEnvelope(bytes: Uint8Array): boolean {
  return (
    bytes.length >= BYTES_HEADER_LENGTH + 16 &&
    BYTES_MAGIC.every((b, i) => bytes[i] === b)
  );
}

/** Splits an encrypted attachment into key version, IV and ciphertext. */
export function parseBytesEnvelope(bytes: Uint8Array): {
  keyVersion: number;
  iv: Uint8Array;
  ct: Uint8Array;
} {
  if (!isBytesEnvelope(bytes))
    throw new CiphertextFormatError("invalid encrypted bytes");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    keyVersion: view.getUint32(4),
    iv: bytes.slice(8, 20),
    ct: bytes.slice(BYTES_HEADER_LENGTH),
  };
}
