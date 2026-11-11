/**
 * What this browser remembers about an organisation's data key, so a server can't quietly roll
 * it back or swap it: the highest key version seen and that version's fingerprint. Later
 * versions are accepted only along verified continuity proofs (see {@link checkKeyChain}). Stored in
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

/** A key version the user could open, with its fingerprint. */
export type HeldKey = { keyVersion: number; fingerprint: string };

/** What {@link checkKeyChain} decides about the keys the server presented. */
export type KeyChainResult =
  | {
      ok: true;
      /** Versions linked to the anchor by verified continuity proofs; only these may be used. */
      trusted: Set<number>;
      /** The pin to store now, if the current version is held. */
      pin?: KeyPin;
      /** The pinned version before, if the current version is newer. */
      rotatedFrom?: number;
    }
  | { ok: false; reason: string };

/**
 * Decides which key versions to trust. The anchor is the pinned version or, in a browser
 * without a pin, the oldest version the user holds (trust on first use). From there, a version
 * is trusted only if its continuity proof under the version before it verified (`links` holds
 * those versions), so a server can't slip in a key of its own making, under a new version or
 * an old one. Fails for a rolled back version, a pinned version with a different key, a pinned
 * version the user no longer holds, and a current version outside the chain.
 */
export function checkKeyChain(input: {
  pin: KeyPin | undefined;
  held: HeldKey[];
  links: ReadonlySet<number>;
  currentVersion: number;
}): KeyChainResult {
  const { pin, links, currentVersion } = input;
  const held = new Map(input.held.map((k) => [k.keyVersion, k.fingerprint]));
  const current = held.get(currentVersion);

  if (pin && currentVersion < pin.keyVersion)
    return {
      ok: false,
      reason: `Schlüsselversion ${currentVersion} ist älter als die zuvor gesehene Version ${pin.keyVersion}.`,
    };
  if (pin && held.has(pin.keyVersion) && held.get(pin.keyVersion) !== pin.fingerprint)
    return {
      ok: false,
      reason: `Schlüsselversion ${pin.keyVersion} hat einen anderen Fingerabdruck als zuvor.`,
    };
  if (pin && !held.has(pin.keyVersion) && current !== undefined)
    return {
      ok: false,
      reason: `Schlüsselversion ${currentVersion} lässt sich nicht auf die zuvor gesehene Version ${pin.keyVersion} zurückführen, weil Sie diese nicht mehr besitzen.`,
    };

  const versions = [...held.keys()];
  const anchor = pin && held.has(pin.keyVersion) ? pin.keyVersion : Math.min(...versions);
  const trusted = new Set<number>();
  if (held.has(anchor)) {
    trusted.add(anchor);
    for (let v = anchor + 1; held.has(v) && links.has(v); v++) trusted.add(v);
    for (let v = anchor - 1; held.has(v) && links.has(v + 1); v--) trusted.add(v);
  }

  if (current === undefined) return { ok: true, trusted };
  if (!trusted.has(currentVersion))
    return {
      ok: false,
      reason: `Schlüsselversion ${currentVersion} hat keinen gültigen Nachweis, dass sie von Version ${anchor} abstammt.`,
    };
  return {
    ok: true,
    trusted,
    pin: { keyVersion: currentVersion, fingerprint: current },
    rotatedFrom: pin && pin.keyVersion < currentVersion ? pin.keyVersion : undefined,
  };
}

/**
 * Whether this browser has seen the org encrypted before. If so, a server claiming the org has
 * no encryption is lying, and the app must not fall back to writing plaintext.
 */
export function hasSeenEncryption(orgId: string): boolean {
  return !!readKeyPin(orgId);
}
