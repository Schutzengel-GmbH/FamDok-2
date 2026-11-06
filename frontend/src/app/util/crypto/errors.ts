/**
 * Errors of the org encryption. Each maps a WebCrypto or library failure to what it means for
 * the user, so callers can show the right message without inspecting `DOMException` names.
 */

/** A field or attachment didn't decrypt: wrong key, wrong context, or tampered ciphertext. */
export class DecryptionError extends Error {
  override name = 'DecryptionError';
}

/** A ciphertext refers to a key version the current session doesn't hold. */
export class UnknownKeyVersionError extends Error {
  override name = 'UnknownKeyVersionError';
}

/** Stored KDF parameters are malformed or outside the accepted bounds. */
export class InvalidKdfParamsError extends Error {
  override name = 'InvalidKdfParamsError';
}

/** The private key didn't unwrap: wrong passphrase, wrong user, or tampered wrapped key. */
export class WrongPassphraseError extends Error {
  override name = 'WrongPassphraseError';
}

/** A grant didn't open: not meant for this key pair, wrong org/version, or tampered. */
export class InvalidGrantError extends Error {
  override name = 'InvalidGrantError';
}

/** The recovery code doesn't open the recovery-wrapped key. */
export class WrongRecoveryCodeError extends Error {
  override name = 'WrongRecoveryCodeError';
}

/** Personal data was requested while the org data key isn't unlocked in this tab. */
export class KeysLockedError extends Error {
  override name = 'KeysLockedError';
}

/**
 * The server presents an org key that contradicts what this browser saw before: a lower
 * version, or a different key under the same version. See `KeyPinStore`.
 */
export class KeyPinMismatchError extends Error {
  override name = 'KeyPinMismatchError';
}
