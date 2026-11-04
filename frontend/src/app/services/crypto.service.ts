import { Injectable } from '@angular/core';
import { FieldContext } from '../../../../shared/utils/ciphertext';

interface VersionedKey {
  version: number;
  key: CryptoKey;
}
type KeyResolver = (version: number) => CryptoKey | undefined;

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

  encryptField(
    plaintext: string,
    key: VersionedKey,
    ctx: FieldContext,
  ): Promise<string> {
    throw Error('not implemented yet');
  }

  decryptField(
    envelope: string,
    keys: KeyResolver,
    ctx: FieldContext,
  ): Promise<string> {
    throw Error('not implemented yet');
  }
}
