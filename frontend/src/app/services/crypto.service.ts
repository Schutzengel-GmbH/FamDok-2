import { Injectable } from '@angular/core';
import {
  buildAad,
  FieldContext,
  formatEnvelope,
  fromB64Url,
  parseEnvelope,
  parseWrappedPrivateKey,
  toB64Url,
} from '../../../../shared/utils/ciphertext';
import SuperJSON from 'superjson';
import { DecryptionError, UnknownKeyVersionError } from '../util/crypto/errors';

export interface VersionedKey {
  version: number;
  key: CryptoKey;
}
export type KeyResolver = (version: number) => CryptoKey | undefined;

@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  generateDataKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
  }

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

  async encryptJson<T>(
    object: T,
    key: VersionedKey,
    ctx: FieldContext,
  ): Promise<string> {
    const plaintext = SuperJSON.stringify(object);
    return this.encryptField(plaintext, key, ctx);
  }

  async decryptJson<T>(
    envelope: string,
    keys: KeyResolver,
    ctx: FieldContext,
  ): Promise<T> {
    return SuperJSON.parse<T>(await this.decryptField(envelope, keys, ctx));
  }

  generateUserKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
  }

  exportPublicKey(key: CryptoKey): Promise<ArrayBuffer> {
    return crypto.subtle.exportKey('spki', key);
  }

  importPublicKey(s: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      'spki',
      fromB64Url(s),
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      [],
    );
  }

  async wrapPrivateKey(
    priv: CryptoKey,
    kek: CryptoKey,
    userId: string,
  ): Promise<string> {
    const encoder = new TextEncoder();
    const iv = this.randomBytes(12);
    const additionalData = encoder.encode(`famdok-userkey-v1:${userId}`);

    const wrapped = await crypto.subtle.wrapKey('pkcs8', priv, kek, {
      name: 'AES-GCM',
      iv,
      additionalData,
    });

    return `k1.${toB64Url(iv)}.${toB64Url(new Uint8Array(wrapped))}`;
  }

  async unwrapPrivateKey(
    wrapped: string,
    kek: CryptoKey,
    userId: string,
  ): Promise<CryptoKey> {
    const { iv, ct } = parseWrappedPrivateKey(wrapped);
    const encoder = new TextEncoder();

    return crypto.subtle.unwrapKey(
      'pkcs8',
      fromB64Url(ct),
      kek,
      {
        name: 'AES-GCM',
        iv: fromB64Url(iv),
        additionalData: encoder.encode(`famdok-userkey-v1:${userId}`),
      },
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    );
  }

  private randomBytes(n: number): Uint8Array {
    const bytes = new Uint8Array(n);
    return crypto.getRandomValues(bytes);
  }
}
