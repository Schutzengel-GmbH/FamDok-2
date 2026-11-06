import { inject, Injectable } from '@angular/core';
import {
  ANSWER_VALUE_FIELDS,
  BLOB_FIELDS,
  ContextRow,
  ENCRYPTED_COLUMNS,
  EncryptedModel,
  attachmentContentContext,
  encryptionContext,
  isBlobModel,
} from '../../../../shared/utils/encryptedModels';
import { isBytesEnvelope, isEnvelope } from '../../../../shared/utils/ciphertext';
import { CryptoService, KeyResolver, VersionedKey } from './crypto.service';
import { KeyApiService, ReencryptMode } from './key-api.service';

/** Progress of a bulk job, for the progress bar. */
export type JobProgress = {
  phase: 'rows' | 'attachments' | 'done';
  model?: EncryptedModel;
  done: number;
  total: number;
};

/** Rows fetched per request; well below the server's limit of 500. */
const BATCH = 100;

/**
 * The two bulk jobs a coordinator's browser runs over all of an org's encrypted data:
 * - migration: encrypt rows that still hold plaintext from before the org set up encryption
 * - rotation: decrypt every value with the old key and encrypt it with the new one
 *
 * Both fetch batches the server says still need work and upload the result, so an interrupted
 * job just continues where it stopped when run again.
 */
@Injectable({ providedIn: 'root' })
export class ReencryptJobService {
  private api = inject(KeyApiService);
  private crypto = inject(CryptoService);

  /**
   * Runs a job to completion. `key` is the key to encrypt with (current version for migration,
   * the new one for rotation); `oldKeys` resolves the keys to decrypt with during a rotation.
   */
  async run(
    orgId: string,
    mode: ReencryptMode,
    key: VersionedKey,
    oldKeys: KeyResolver,
    onProgress: (p: JobProgress) => void = () => {},
  ): Promise<void> {
    const status = await this.api.getJobStatus(orgId, mode);
    const total =
      Object.values(status.rows).reduce((a, b) => a + b, 0) + status.attachmentContents;
    let done = 0;

    for (const model of Object.keys(ENCRYPTED_COLUMNS) as EncryptedModel[]) {
      const attempted = new Set<string>();
      for (;;) {
        const rows = await this.api.getJobRows(orgId, mode, model, BATCH);
        if (rows.length === 0) break;
        // the server offers only rows it already got back: they can't be processed, stop
        if (rows.every((r) => attempted.has(r['id'])))
          throw new Error(`${model}: rows could not be updated`);
        rows.forEach((r) => attempted.add(r['id']));
        const prepared = await Promise.all(
          rows.map(async (row) => ({
            id: row['id'] as string,
            values:
              mode === 'migration'
                ? await this.migrateRow(model, row, key)
                : await this.rotateRow(model, row, key, oldKeys),
          })),
        );
        await this.api.putJobRows(orgId, mode, { model, rows: prepared });
        done += rows.length;
        onProgress({ phase: 'rows', model, done, total });
      }
    }

    for (;;) {
      const attachments = await this.api.getJobAttachments(orgId, mode);
      if (attachments.length === 0) break;
      for (const attachment of attachments) {
        const stored = await this.api.getJobAttachmentContent(orgId, mode, attachment.id);
        const ctx = attachmentContentContext(attachment.id);
        const plain =
          mode === 'rotation' || isBytesEnvelope(stored)
            ? await this.crypto.decryptBytes(stored, oldKeys, ctx)
            : stored;
        const encrypted = await this.crypto.encryptBytes(plain, key, ctx);
        await this.api.putJobAttachmentContent(orgId, mode, attachment.id, key.version, encrypted);
        done += 1;
        onProgress({ phase: 'attachments', done, total });
      }
    }
    onProgress({ phase: 'done', done: total, total });
  }

  /** Encrypts the plaintext of one row under `key`. */
  async migrateRow(
    model: EncryptedModel,
    row: Record<string, any>,
    key: VersionedKey,
  ): Promise<Record<string, string | null>> {
    const ctxRow = row as ContextRow;
    if (isBlobModel(model)) {
      const fields: Record<string, unknown> = {};
      for (const f of BLOB_FIELDS[model]) fields[f] = row[f] ?? null;
      return {
        encrypted: await this.crypto.encryptJson(
          fields,
          key,
          encryptionContext(model, ctxRow, 'encrypted'),
        ),
      };
    }
    if (model === 'Answer') {
      const values: Record<string, unknown> = {};
      for (const f of ANSWER_VALUE_FIELDS) values[f] = row[f];
      return {
        answerEncrypted: await this.crypto.encryptJson(
          values,
          key,
          encryptionContext(model, ctxRow, 'answerEncrypted'),
        ),
      };
    }
    const values: Record<string, string | null> = {};
    for (const column of ENCRYPTED_COLUMNS[model]) {
      const value = row[column];
      if (value === undefined || isEnvelope(value)) continue;
      values[column] =
        value === null || value === ''
          ? null
          : await this.crypto.encryptField(value, key, encryptionContext(model, ctxRow, column));
    }
    return values;
  }

  /**
   * Re-encrypts every envelope of one row under `key`. The plaintext never leaves this method:
   * decrypt with the old key, encrypt with the new one in the same context.
   */
  async rotateRow(
    model: EncryptedModel,
    row: Record<string, any>,
    key: VersionedKey,
    oldKeys: KeyResolver,
  ): Promise<Record<string, string | null>> {
    const values: Record<string, string | null> = {};
    for (const column of ENCRYPTED_COLUMNS[model]) {
      const value = row[column];
      if (!isEnvelope(value)) continue;
      const ctx = encryptionContext(model, row as ContextRow, column);
      const plain = await this.crypto.decryptField(value, oldKeys, ctx);
      values[column] = await this.crypto.encryptField(plain, key, ctx);
    }
    return values;
  }
}
