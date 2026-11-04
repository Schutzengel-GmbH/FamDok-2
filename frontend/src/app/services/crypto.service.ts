import { Injectable } from '@angular/core';
import {
  buildAad,
  FieldContext,
  formatEnvelope,
  fromB64Url,
  parseEnvelope,
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
    const iv = this.randomBytes(12);
    const encoder = new TextEncoder();
    const additionalData = encoder.encode(buildAad(ctx));
    const plaintextBytes = encoder.encode(plaintext);
    const res = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData },
      key.key,
      plaintextBytes,
    );
    const env = formatEnvelope(
      key.version,
      toB64Url(iv),
      toB64Url(new Uint8Array(res)),
    );
    return env;
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

  private randomBytes(n: number): Uint8Array {
    const bytes = new Uint8Array(n);
    return crypto.getRandomValues(bytes);
  }
}
