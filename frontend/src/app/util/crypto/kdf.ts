import { argon2id } from 'hash-wasm';
import {
  CiphertextFormatError,
  fromB64Url,
  toB64Url,
} from '../../../../../shared/utils/ciphertext';
import { InvalidKdfParamsError } from './errors';

/**
 * Passphrase key derivation. The passphrase becomes a key-encryption key (KEK) via Argon2id
 * (hash-wasm), and the KEK wraps the user's private key. The parameters are stored next to the
 * wrapped key, so they can be raised later without breaking existing users.
 */

/** Argon2id parameters as stored on the server, salt as base64url. */
export interface Argon2idParams {
  alg: 'argon2id';
  salt: string /* b64url, 16 bytes */;
  memoryKiB: number;
  iterations: number;
  parallelism: 1;
}

export type KdfParams = Argon2idParams; // a union later if we ever add another KDF

/**
 * Fresh parameters with a random 16-byte salt. Defaults: 64 MiB, 5 iterations, one lane; aim
 * for 0.5-1 s on the slowest client machine.
 */
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

/**
 * Throws `InvalidKdfParamsError` unless the parameters are well-formed and within bounds. They
 * come from the server, so a tampered record must not be able to exhaust the browser's memory or
 * time. The lower bounds are deliberately low, so tests can derive cheaply: parameters only read
 * here can't weaken anything (wrong ones just fail to unwrap the key), and new wraps always use
 * {@link newKdfParams}. The server refuses to store parameters below the OWASP minimum (see
 * `KdfParamsSchema` in shared/api/keys.ts).
 */
export function validateKdfParams(params: KdfParams) {
  if (typeof params !== 'object' || params === null)
    throw new InvalidKdfParamsError('missing params');
  if (params.alg !== 'argon2id')
    throw new InvalidKdfParamsError('bad algorithm');
  if (typeof params.salt !== 'string')
    throw new InvalidKdfParamsError('missing salt');
  let salt: Uint8Array;
  try {
    salt = fromB64Url(params.salt);
  } catch (e) {
    if (e instanceof CiphertextFormatError)
      throw new InvalidKdfParamsError('cannot decode salt');
    throw new InvalidKdfParamsError(
      e instanceof Error ? e.name : 'unknown error',
    );
  }
  if (salt.length !== 16) throw new InvalidKdfParamsError('invalid salt');
  if (!Number.isInteger(params.memoryKiB))
    throw new InvalidKdfParamsError('memory must be an integer');
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

/**
 * Argon2id over the NFC-normalized passphrase, 32 bytes. Normalizing makes "ü" typed as one or
 * as two code points derive the same key. Runs in a Web Worker in the app (see kdf.worker.ts).
 */
export async function deriveKeyBytes(passphrase: string, params: KdfParams) {
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

/** Derives the KEK on the current thread. Tests use it; the app derives in the worker. */
export async function deriveKek(passphrase: string, params: KdfParams) {
  const bytes = await deriveKeyBytes(passphrase, params);
  return importKek(bytes);
}

/**
 * Turns derived bytes into the non-extractable AES-GCM KEK, usable only to wrap and unwrap
 * keys, and wipes the bytes.
 */
export async function importKek(bytes: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle
    .importKey('raw', bytes, 'AES-GCM', false, ['wrapKey', 'unwrapKey'])
    .finally(() => bytes.fill(0));
}
