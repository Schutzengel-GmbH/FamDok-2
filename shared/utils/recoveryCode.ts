/**
 * Recovery codes and fingerprints: the two things people read, type or compare by hand.
 * Pure functions, so they can be tested without WebCrypto.
 */

/** Crockford base32: no I, L, O or U, so a printed code can't be misread. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Number of random bytes in a recovery code: 160 bits, far beyond offline guessing. */
export const RECOVERY_CODE_BYTES = 20;

/** Thrown when a typed recovery code has the wrong length or characters. */
export class InvalidRecoveryCodeError extends Error {
  override name = "InvalidRecoveryCodeError";
}

/**
 * Formats random bytes as a recovery code: Crockford base32 in groups of four separated by
 * dashes, e.g. `7K3M-…` (8 groups for 20 bytes).
 */
export function formatRecoveryCode(bytes: Uint8Array): string {
  if (bytes.length !== RECOVERY_CODE_BYTES)
    throw new InvalidRecoveryCodeError("wrong number of bytes");
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  return out.match(/.{1,4}/g)!.join("-");
}

/**
 * Parses a typed recovery code back to its bytes. Case, spaces and dashes don't matter, and the
 * look-alikes O/I/L are read as 0/1/1, so a code copied by hand still works.
 */
export function parseRecoveryCode(code: string): Uint8Array {
  const clean = code
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (clean.length !== (RECOVERY_CODE_BYTES * 8) / 5)
    throw new InvalidRecoveryCodeError("wrong length");

  const out = new Uint8Array(RECOVERY_CODE_BYTES);
  let bits = 0;
  let value = 0;
  let i = 0;
  for (const ch of clean) {
    const v = CROCKFORD.indexOf(ch);
    if (v < 0) throw new InvalidRecoveryCodeError(`invalid character ${ch}`);
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out[i++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return out;
}

/**
 * Turns a SHA-256 digest into six groups of five digits, e.g. `04217 88310 …`. Digits read well
 * over the phone, and 30 digits leave no room for a look-alike key.
 */
export function formatFingerprint(digest: Uint8Array): string {
  if (digest.length < 30) throw new Error("digest too short");
  const groups: string[] = [];
  for (let g = 0; g < 6; g++) {
    let n = 0;
    for (let i = 0; i < 5; i++) n = n * 256 + digest[g * 5 + i];
    groups.push(String(n % 100000).padStart(5, "0"));
  }
  return groups.join(" ");
}
