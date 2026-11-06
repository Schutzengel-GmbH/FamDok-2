import { KeyPinMismatchError } from './errors';

/**
 * What this browser remembers about an organisation's data key, so a server can't quietly roll
 * it back or swap it: the highest key version seen and that version's fingerprint. Stored in
 * localStorage; losing it (another browser, cleared storage) just means trusting on next use,
 * as on the very first login.
 */
export type KeyPin = { keyVersion: number; fingerprint: string };

const STORAGE_PREFIX = 'famdok.keyPin.';

/** Reads the pin of an org, `undefined` if there is none or storage is unavailable. */
export function readKeyPin(orgId: string): KeyPin | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + orgId);
    if (!raw) return undefined;
    const pin = JSON.parse(raw) as KeyPin;
    return Number.isInteger(pin.keyVersion) && typeof pin.fingerprint === 'string'
      ? pin
      : undefined;
  } catch {
    return undefined;
  }
}

/** Remembers the key an org presents now. */
export function writeKeyPin(orgId: string, pin: KeyPin) {
  try {
    localStorage.setItem(STORAGE_PREFIX + orgId, JSON.stringify(pin));
  } catch {
    // storage blocked or full: the pin is a safety net, not a requirement
  }
}

/** Forgets the pin, e.g. after the user confirmed a new key out of band. */
export function clearKeyPin(orgId: string) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + orgId);
  } catch {
    // see writeKeyPin
  }
}

/**
 * Checks a freshly opened key against the pin and updates it. Throws `KeyPinMismatchError` for a
 * lower version than seen before, or a different key under the same version. A higher version
 * is accepted (rotations are legitimate) and reported, so the UI can tell the user.
 */
export function checkKeyPin(
  orgId: string,
  key: KeyPin,
): { rotated: boolean; previous?: KeyPin } {
  const pin = readKeyPin(orgId);
  if (pin && key.keyVersion < pin.keyVersion)
    throw new KeyPinMismatchError(
      `Key version ${key.keyVersion} is older than version ${pin.keyVersion} seen before`,
    );
  if (pin && key.keyVersion === pin.keyVersion && key.fingerprint !== pin.fingerprint)
    throw new KeyPinMismatchError(`Key version ${key.keyVersion} changed its fingerprint`);
  writeKeyPin(orgId, key);
  return { rotated: !!pin && key.keyVersion > pin.keyVersion, previous: pin };
}

/**
 * Whether this browser has seen the org encrypted before. If so, a server claiming the org has
 * no encryption is lying, and the app must not fall back to writing plaintext.
 */
export function hasSeenEncryption(orgId: string): boolean {
  return !!readKeyPin(orgId);
}
