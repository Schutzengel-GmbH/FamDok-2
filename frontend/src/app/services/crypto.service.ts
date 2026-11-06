import { Injectable } from '@angular/core';
import {
  AEAD_AES_256_GCM,
  CipherSuite,
  DecapError,
  KDF_HKDF_SHA256,
  KEM_DHKEM_P256_HKDF_SHA256,
  OpenError,
} from 'hpke';
import {
  buildAad,
  buildGrantInfo,
  buildRecoveryAad,
  FieldContext,
  formatBytesEnvelope,
  formatEnvelope,
  formatGrant,
  formatRecoveryWrappedKey,
  formatWrappedPrivateKey,
  fromB64Url,
  OrgKeyContext,
  parseBytesEnvelope,
  parseEnvelope,
  parseGrant,
  parseRecoveryWrappedKey,
  parseWrappedPrivateKey,
  toB64Url,
} from '../../../../shared/utils/ciphertext';
import {
  formatFingerprint,
  formatRecoveryCode,
  parseRecoveryCode,
  RECOVERY_CODE_BYTES,
} from '../../../../shared/utils/recoveryCode';
import SuperJSON from 'superjson';
import {
  DecryptionError,
  InvalidGrantError,
  UnknownKeyVersionError,
  WrongPassphraseError,
  WrongRecoveryCodeError,
} from '../util/crypto/errors';

/** An org data key together with the version it is stored under. */
export interface VersionedKey {
  version: number;
  key: CryptoKey;
}

/**
 * An org data key unlocked for this session: non-extractable, plus a fingerprint computed while
 * its bytes were briefly available, so people can compare keys without exporting them.
 */
export interface UnlockedDataKey extends VersionedKey {
  fingerprint: string;
}

/** Looks up the data key for a key version, `undefined` if the session doesn't hold it. */
export type KeyResolver = (version: number) => CryptoKey | undefined;

/** AES-GCM additional data for a wrapped private key, binding it to its user. */
function buildUserkey(userId: string) {
  return `famdok-userkey-v1:${userId}`;
}

/** Domain separation for the data key fingerprint, so it can't collide with other hashes. */
const DEK_FINGERPRINT_PREFIX = new TextEncoder().encode('famdok-dek-fp-v1');
/** HKDF info for the key derived from a recovery code. */
const RECOVERY_KDF_INFO = new TextEncoder().encode('famdok-recovery-kdf-v1');

/**
 * All cryptography of the org encryption, on WebCrypto plus HPKE (RFC 9180) for grants. Pure in
 * the sense that it holds no keys itself: callers pass keys in and get ciphertext or keys back.
 * `KeySessionService` keeps the unlocked keys of the current tab.
 */
@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  /** DHKEM(P-256, HKDF-SHA256) / HKDF-SHA256 / AES-256-GCM, matching the user key pairs. */
  private readonly hpke = new CipherSuite(
    KEM_DHKEM_P256_HKDF_SHA256,
    KDF_HKDF_SHA256,
    AEAD_AES_256_GCM,
  );

  /**
   * Generates a new org data key (DEK). It is extractable, because at org setup and rotation it
   * still has to be granted and wrapped for recovery; sessions only ever hold non-extractable
   * copies opened from grants.
   */
  generateDataKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
  }

  /**
   * Encrypts a string for one field of one row: AES-256-GCM with a fresh 12-byte IV and the
   * field context as additional data, returned as a `v1.` envelope.
   */
  async encryptField(
    plaintext: string,
    key: VersionedKey,
    ctx: FieldContext,
  ): Promise<string> {
    const encoder = new TextEncoder();

    const iv = this.randomBytes(12);

    const additionalData = encoder.encode(buildAad(ctx));
    const plaintextBytes = encoder.encode(plaintext);

    const encryptedBytes = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData },
      key.key,
      plaintextBytes,
    );

    return formatEnvelope(
      key.version,
      toB64Url(iv),
      toB64Url(new Uint8Array(encryptedBytes)),
    );
  }

  /**
   * Decrypts a `v1.` envelope written for `ctx`. Throws `UnknownKeyVersionError` if the session
   * lacks the key version, `DecryptionError` if key, context or ciphertext don't match.
   */
  async decryptField(
    envelope: string,
    keys: KeyResolver,
    ctx: FieldContext,
  ): Promise<string> {
    const { keyVersion, iv, ct } = parseEnvelope(envelope);

    const key = keys(keyVersion);
    if (!key) throw new UnknownKeyVersionError();

    const aad = buildAad(ctx);

    const encoder = new TextEncoder();

    try {
      const plaintextBytes = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: fromB64Url(iv),
          additionalData: encoder.encode(aad),
        },
        key,
        fromB64Url(ct),
      );
      return new TextDecoder('utf-8', { fatal: true }).decode(plaintextBytes);
    } catch (e) {
      if (e instanceof Error && e.name === 'OperationError')
        throw new DecryptionError();
      throw e;
    }
  }

  /** {@link encryptField} for structured values, serialized with SuperJSON (keeps Dates). */
  async encryptJson<T>(
    object: T,
    key: VersionedKey,
    ctx: FieldContext,
  ): Promise<string> {
    const plaintext = SuperJSON.stringify(object);
    return this.encryptField(plaintext, key, ctx);
  }

  /** {@link decryptField} for values written by {@link encryptJson}. */
  async decryptJson<T>(
    envelope: string,
    keys: KeyResolver,
    ctx: FieldContext,
  ): Promise<T> {
    return SuperJSON.parse<T>(await this.decryptField(envelope, keys, ctx));
  }

  /**
   * Encrypts an attachment's content. Same scheme as {@link encryptField}, in the binary
   * `FDK1` format, so large files don't grow by base64.
   */
  async encryptBytes(
    plaintext: Uint8Array,
    key: VersionedKey,
    ctx: FieldContext,
  ): Promise<Uint8Array> {
    const iv = this.randomBytes(12);
    const ct = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: new TextEncoder().encode(buildAad(ctx)),
      },
      key.key,
      plaintext,
    );
    return formatBytesEnvelope(key.version, iv, new Uint8Array(ct));
  }

  /** Decrypts what {@link encryptBytes} produced, with the same errors as {@link decryptField}. */
  async decryptBytes(
    envelope: Uint8Array,
    keys: KeyResolver,
    ctx: FieldContext,
  ): Promise<Uint8Array> {
    const { keyVersion, iv, ct } = parseBytesEnvelope(envelope);
    const key = keys(keyVersion);
    if (!key) throw new UnknownKeyVersionError();
    try {
      const pt = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
          additionalData: new TextEncoder().encode(buildAad(ctx)),
        },
        key,
        ct,
      );
      return new Uint8Array(pt);
    } catch (e) {
      if (e instanceof Error && e.name === 'OperationError')
        throw new DecryptionError();
      throw e;
    }
  }

  /**
   * Generates a user's ECDH P-256 key pair. The private key is extractable only so it can be
   * wrapped once under the passphrase key; afterwards only unwrapped, non-extractable copies
   * are used.
   */
  generateUserKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
  }

  /** Exports a public key as base64url SPKI (122 characters for P-256). */
  async exportPublicKey(key: CryptoKey): Promise<string> {
    return toB64Url(new Uint8Array(await crypto.subtle.exportKey('spki', key)));
  }

  /**
   * Imports a base64url SPKI public key. It must stay extractable: HPKE serializes the
   * recipient's public key into the key schedule.
   */
  importPublicKey(s: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'spki',
      fromB64Url(s),
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      [],
    );
  }

  /**
   * The fingerprint people compare out of band before a coordinator grants access: SHA-256 of
   * the SPKI bytes as six groups of five digits.
   */
  async publicKeyFingerprint(publicKey: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', fromB64Url(publicKey));
    return formatFingerprint(new Uint8Array(digest));
  }

  /** Wraps the private key under the passphrase key (KEK), bound to the user's id. */
  async wrapPrivateKey(
    priv: CryptoKey,
    kek: CryptoKey,
    userId: string,
  ): Promise<string> {
    const encoder = new TextEncoder();
    const iv = this.randomBytes(12);
    const additionalData = encoder.encode(buildUserkey(userId));

    const wrapped = await crypto.subtle.wrapKey('pkcs8', priv, kek, {
      name: 'AES-GCM',
      iv,
      additionalData,
    });

    return formatWrappedPrivateKey(
      toB64Url(iv),
      toB64Url(new Uint8Array(wrapped)),
    );
  }

  /**
   * Unwraps the private key as non-extractable, usable only for `deriveBits`. Any mismatch
   * (passphrase, user id, tampering) surfaces as `WrongPassphraseError`.
   */
  async unwrapPrivateKey(
    wrapped: string,
    kek: CryptoKey,
    userId: string,
  ): Promise<CryptoKey> {
    const { iv, ct } = parseWrappedPrivateKey(wrapped);
    const encoder = new TextEncoder();

    try {
      return await crypto.subtle.unwrapKey(
        'pkcs8',
        fromB64Url(ct),
        kek,
        {
          name: 'AES-GCM',
          iv: fromB64Url(iv),
          additionalData: encoder.encode(buildUserkey(userId)),
        },
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits'],
      );
    } catch (e) {
      if (e instanceof Error && e.name === 'OperationError')
        throw new WrongPassphraseError();
      throw e;
    }
  }

  /**
   * Re-wraps the private key under a new passphrase key. The key is unwrapped as extractable
   * only inside this call, to be wrapped again, and is never returned.
   */
  async rewrapPrivateKey(
    wrapped: string,
    oldKek: CryptoKey,
    newKek: CryptoKey,
    userId: string,
  ): Promise<string> {
    const { iv, ct } = parseWrappedPrivateKey(wrapped);
    const additionalData = new TextEncoder().encode(buildUserkey(userId));
    let priv: CryptoKey;
    try {
      priv = await crypto.subtle.unwrapKey(
        'pkcs8',
        fromB64Url(ct),
        oldKek,
        { name: 'AES-GCM', iv: fromB64Url(iv), additionalData },
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits'],
      );
    } catch (e) {
      if (e instanceof Error && e.name === 'OperationError')
        throw new WrongPassphraseError();
      throw e;
    }
    return this.wrapPrivateKey(priv, newKek, userId);
  }

  /**
   * Grants a freshly generated, still extractable data key to a user: HPKE-seals its 32 bytes
   * to the user's public key, bound to org and key version. Used at org setup and rotation.
   */
  async sealGrant(
    dek: CryptoKey,
    recipientPub: CryptoKey,
    ctx: OrgKeyContext,
  ): Promise<string> {
    const bytes = new Uint8Array(await crypto.subtle.exportKey('raw', dek));
    try {
      return await this.sealGrantBytes(bytes, recipientPub, ctx);
    } finally {
      bytes.fill(0);
    }
  }

  /**
   * Opens the user's own grant into a non-extractable session key. `me` must be the key pair,
   * since the library can't derive the public key from a non-extractable private key.
   */
  async openGrant(
    grant: string,
    me: CryptoKeyPair,
    ctx: OrgKeyContext,
  ): Promise<UnlockedDataKey> {
    const bytes = await this.openGrantBytes(grant, me, ctx);
    try {
      return await this.importDataKey(bytes, ctx.keyVersion);
    } finally {
      bytes.fill(0);
    }
  }

  /**
   * Grants the current data key to another user via the coordinator's own grant, so the
   * session key never has to be extractable: open own grant to bytes, seal them, wipe them.
   */
  async regrant(
    myGrant: string,
    me: CryptoKeyPair,
    recipientPub: CryptoKey,
    ctx: OrgKeyContext,
  ): Promise<string> {
    const bytes = await this.openGrantBytes(myGrant, me, ctx);
    try {
      return await this.sealGrantBytes(bytes, recipientPub, ctx);
    } finally {
      bytes.fill(0);
    }
  }

  /** A new random recovery code (160 bits) in its printable form. */
  generateRecoveryCode(): string {
    return formatRecoveryCode(this.randomBytes(RECOVERY_CODE_BYTES));
  }

  /**
   * Wraps a freshly generated data key under a recovery code, for the org to keep offline. The
   * code has full entropy, so HKDF suffices; no slow KDF is needed.
   */
  async sealRecovery(
    dek: CryptoKey,
    recoveryCode: string,
    ctx: OrgKeyContext,
  ): Promise<string> {
    const kek = await this.recoveryKek(recoveryCode, ['encrypt']);
    const bytes = new Uint8Array(await crypto.subtle.exportKey('raw', dek));
    try {
      const iv = this.randomBytes(12);
      const ct = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
          additionalData: new TextEncoder().encode(buildRecoveryAad(ctx)),
        },
        kek,
        bytes,
      );
      return formatRecoveryWrappedKey(
        ctx.keyVersion,
        toB64Url(iv),
        toB64Url(new Uint8Array(ct)),
      );
    } finally {
      bytes.fill(0);
    }
  }

  /**
   * Opens a recovery-wrapped key with the recovery code and grants it to `recipientPub` (a
   * coordinator's new key pair). Returns the grant to upload and the unlocked key.
   */
  async openRecovery(
    wrapped: string,
    recoveryCode: string,
    ctx: OrgKeyContext,
    recipientPub: CryptoKey,
  ): Promise<{ grant: string; dataKey: UnlockedDataKey }> {
    const { keyVersion, iv, ct } = parseRecoveryWrappedKey(wrapped);
    if (keyVersion !== ctx.keyVersion) throw new WrongRecoveryCodeError();
    const kek = await this.recoveryKek(recoveryCode, ['decrypt']);

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(
        await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: fromB64Url(iv),
            additionalData: new TextEncoder().encode(buildRecoveryAad(ctx)),
          },
          kek,
          fromB64Url(ct),
        ),
      );
    } catch (e) {
      if (e instanceof Error && e.name === 'OperationError')
        throw new WrongRecoveryCodeError();
      throw e;
    }

    try {
      return {
        grant: await this.sealGrantBytes(bytes, recipientPub, ctx),
        dataKey: await this.importDataKey(bytes, ctx.keyVersion),
      };
    } finally {
      bytes.fill(0);
    }
  }

  /** HPKE single-shot seal of raw key bytes, as a `g1.` grant. */
  private async sealGrantBytes(
    dekBytes: Uint8Array,
    recipientPub: CryptoKey,
    ctx: OrgKeyContext,
  ): Promise<string> {
    const info = new TextEncoder().encode(buildGrantInfo(ctx));
    const { encapsulatedSecret, ciphertext } = await this.hpke.Seal(
      recipientPub,
      dekBytes,
      { info },
    );
    return formatGrant(toB64Url(encapsulatedSecret), toB64Url(ciphertext));
  }

  /**
   * Raw key bytes out of a grant; the caller wipes them. Library failures that mean "this grant
   * isn't for you or was tampered with" become `InvalidGrantError`.
   */
  private async openGrantBytes(
    grant: string,
    me: CryptoKeyPair,
    ctx: OrgKeyContext,
  ): Promise<Uint8Array> {
    const { enc, ct } = parseGrant(grant);
    const info = new TextEncoder().encode(buildGrantInfo(ctx));
    try {
      return await this.hpke.Open(me, fromB64Url(enc), fromB64Url(ct), {
        info,
      });
    } catch (e) {
      if (e instanceof OpenError || e instanceof DecapError)
        throw new InvalidGrantError();
      throw e;
    }
  }

  /** Imports raw key bytes as the non-extractable session key and fingerprints them. */
  private async importDataKey(
    bytes: Uint8Array,
    version: number,
  ): Promise<UnlockedDataKey> {
    const key = await crypto.subtle.importKey(
      'raw',
      bytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    const tagged = new Uint8Array(DEK_FINGERPRINT_PREFIX.length + bytes.length);
    tagged.set(DEK_FINGERPRINT_PREFIX);
    tagged.set(bytes, DEK_FINGERPRINT_PREFIX.length);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', tagged));
    tagged.fill(0);
    return { version, key, fingerprint: formatFingerprint(digest) };
  }

  /** The AES-GCM key a recovery code stands for, via HKDF-SHA256. */
  private async recoveryKek(
    recoveryCode: string,
    usages: KeyUsage[],
  ): Promise<CryptoKey> {
    const codeBytes = parseRecoveryCode(recoveryCode);
    const ikm = await crypto.subtle.importKey('raw', codeBytes, 'HKDF', false, [
      'deriveKey',
    ]);
    codeBytes.fill(0);
    return crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(32),
        info: RECOVERY_KDF_INFO,
      },
      ikm,
      { name: 'AES-GCM', length: 256 },
      false,
      usages,
    );
  }

  /** Cryptographically random bytes; a method so tests can pin IVs with `spyOn`. */
  private randomBytes(n: number): Uint8Array {
    const bytes = new Uint8Array(n);
    return crypto.getRandomValues(bytes);
  }
}
