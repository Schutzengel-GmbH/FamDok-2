import { argon2id } from 'hash-wasm';
import {
  CiphertextFormatError,
  fromB64Url,
  toB64Url,
} from '../../../../../shared/utils/ciphertext';
import { InvalidKdfParamsError } from './errors';

export interface Argon2idParams {
  alg: 'argon2id';
  salt: string /* b64url, 16 bytes */;
  memoryKiB: number;
  iterations: number;
  parallelism: 1;
}

export type KdfParams = Argon2idParams; // a union later if we ever add another KDF

export function newKdfParams(
  memoryKiB: number = 65536,
  iterations: number = 5,
): KdfParams {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  return {
    alg: 'argon2id',
    salt: toB64Url(salt),
    memoryKiB: memoryKiB,
    iterations: iterations,
    parallelism: 1,
  };
}

export function validateKdfParams(params: KdfParams) {
  if (params.alg !== 'argon2id')
    throw new InvalidKdfParamsError('bad algorithm');
  let salt: Uint8Array;
  try {
    salt = fromB64Url(params.salt);
  } catch (e) {
    if (e instanceof CiphertextFormatError)
      throw new InvalidKdfParamsError('cannot decode salt');
    throw e;
  }
  if (salt.length !== 16) throw new InvalidKdfParamsError('invalid salt');
  if (!Number.isInteger(params.memoryKiB))
    throw new InvalidKdfParamsError('memory must be a number');
  if (params.memoryKiB < 8) throw new InvalidKdfParamsError('low memoryKiB');
  if (params.memoryKiB > 1_000_000)
    throw new InvalidKdfParamsError('high memoryKiB');
  if (params.parallelism !== 1)
    throw new InvalidKdfParamsError('bad parallelism');
  if (!Number.isInteger(params.iterations))
    throw new InvalidKdfParamsError('iterations must be integer');
  if (params.iterations < 1)
    throw new InvalidKdfParamsError('not enough iterations');
  if (params.iterations > 10)
    throw new InvalidKdfParamsError('too many iterations');
}

export function deriveKeyBytes(passphrase: string, params: KdfParams) {
  const normalisedPassphrase = passphrase.normalize('NFC');
  validateKdfParams(params);

  return argon2id({
    password: normalisedPassphrase,
    salt: fromB64Url(params.salt),
    iterations: params.iterations,
    parallelism: params.parallelism,
    memorySize: params.memoryKiB,
    hashLength: 32,
    outputType: 'binary',
  });
}

export async function deriveKek(passphrase: string, params: KdfParams) {
  const bytes = await deriveKeyBytes(passphrase, params);
  return await crypto.subtle
    .importKey('raw', bytes, 'AES-GCM', false, ['wrapKey', 'unwrapKey'])
    .finally(() => bytes.fill(0));
}
