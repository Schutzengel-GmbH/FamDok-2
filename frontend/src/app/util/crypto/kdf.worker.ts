/// <reference lib="webworker" />
import { deriveKeyBytes, KdfParams } from './kdf';

/**
 * Runs Argon2id off the main thread, so the page stays responsive during the deliberately slow
 * derivation. Receives `{ id, passphrase, params }`, answers `{ id, bytes }` (transferred, so no
 * copy stays here) or `{ id, error }`.
 */
addEventListener(
  'message',
  async ({ data }: MessageEvent<{ id: number; passphrase: string; params: KdfParams }>) => {
    try {
      const bytes = await deriveKeyBytes(data.passphrase, data.params);
      postMessage({ id: data.id, bytes }, [bytes.buffer]);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      postMessage({ id: data.id, error: { name: err.name, message: err.message } });
    }
  },
);
