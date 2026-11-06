import { Injectable } from '@angular/core';
import { deriveKeyBytes, importKek, KdfParams } from '../util/crypto/kdf';
import { InvalidKdfParamsError } from '../util/crypto/errors';

type Pending = {
  resolve: (bytes: Uint8Array) => void;
  reject: (e: Error) => void;
};

/**
 * Derives passphrase keys (KEKs) in a Web Worker, so the half-second of Argon2id doesn't freeze
 * the page. Falls back to the main thread where workers aren't available.
 */
@Injectable({ providedIn: 'root' })
export class KdfService {
  private worker: Worker | null | undefined;
  private nextId = 0;
  private pending = new Map<number, Pending>();

  /** Derives the non-extractable KEK for `passphrase` under `params`. */
  async deriveKek(passphrase: string, params: KdfParams): Promise<CryptoKey> {
    return importKek(await this.deriveBytes(passphrase, params));
  }

  /** Raw Argon2id output, from the worker if possible. */
  private deriveBytes(passphrase: string, params: KdfParams): Promise<Uint8Array> {
    const worker = this.getWorker();
    if (!worker) return deriveKeyBytes(passphrase, params);

    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, passphrase, params });
    });
  }

  /** Starts the worker once; `null` if this environment can't run it. */
  private getWorker(): Worker | null {
    if (this.worker !== undefined) return this.worker;
    try {
      this.worker =
        typeof Worker === 'undefined'
          ? null
          : new Worker(new URL('../util/crypto/kdf.worker', import.meta.url), {
              type: 'module',
            });
    } catch {
      this.worker = null;
    }
    this.worker?.addEventListener('message', (event) => this.onMessage(event));
    this.worker?.addEventListener('error', () => this.failAll());
    return this.worker;
  }

  /** Settles the request a worker answer belongs to, rebuilding known error types. */
  private onMessage({ data }: MessageEvent) {
    const pending = this.pending.get(data.id);
    if (!pending) return;
    this.pending.delete(data.id);
    if (data.bytes) pending.resolve(data.bytes);
    else if (data.error?.name === 'InvalidKdfParamsError')
      pending.reject(new InvalidKdfParamsError(data.error.message));
    else pending.reject(new Error(data.error?.message ?? 'key derivation failed'));
  }

  /** A crashed worker fails everything it was working on; later calls run on the main thread. */
  private failAll() {
    for (const p of this.pending.values()) p.reject(new Error('key derivation worker failed'));
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }
}
