import { TestBed } from '@angular/core/testing';
import { ReencryptJobService } from './reencrypt-job.service';
import { KeyApiService } from './key-api.service';
import { CryptoService, VersionedKey } from './crypto.service';
import {
  ENCRYPTED_COLUMNS,
  EncryptedModel,
  attachmentContentContext,
  encryptionContext,
} from '../../../../shared/utils/encryptedModels';
import {
  envelopeKeyVersion,
  isBytesEnvelope,
  isEnvelope,
  parseBytesEnvelope,
} from '../../../../shared/utils/ciphertext';

type Row = Record<string, any> & { id: string };

/**
 * An in-memory stand-in for the server's job endpoints: it offers rows that still hold
 * plaintext (migration) or envelopes under another version (rotation), and only stores
 * envelopes under the job's version, like backend/util/encryptedRows.ts.
 */
class FakeJobApi {
  rows: Record<string, Row[]> = {};
  attachments: { id: string; content: Uint8Array; contentKeyVersion: number | null }[] = [];
  version = 1;

  private needsWork(mode: string, model: EncryptedModel, row: Row) {
    const cols = ENCRYPTED_COLUMNS[model] as readonly string[];
    if (mode === 'rotation')
      return cols.some((c) => isEnvelope(row[c]) && envelopeKeyVersion(row[c]) !== this.version);
    if (model === 'Family' || model === 'Child') return !row['encrypted'] && row['name'];
    if (model === 'Answer') return !row['answerEncrypted'] && row['answerText'];
    return cols.some((c) => row[c] !== null && row[c] !== undefined && !isEnvelope(row[c]));
  }

  getJobStatus = async (_org: string, mode: string) => ({
    rows: Object.fromEntries(
      Object.keys(ENCRYPTED_COLUMNS).map((m) => [
        m,
        (this.rows[m] ?? []).filter((r) => this.needsWork(mode, m as EncryptedModel, r)).length,
      ]),
    ),
    attachmentContents: this.attachments.filter((a) =>
      mode === 'rotation'
        ? a.contentKeyVersion !== null && a.contentKeyVersion !== this.version
        : a.contentKeyVersion === null,
    ).length,
  });

  getJobRows = async (_org: string, mode: string, model: EncryptedModel, take: number) =>
    structuredClone((this.rows[model] ?? []).filter((r) => this.needsWork(mode, model, r)).slice(0, take));

  putJobRows = async (_org: string, mode: string, body: { model: EncryptedModel; rows: { id: string; values: Record<string, string | null> }[] }) => {
    let changed = 0;
    for (const { id, values } of body.rows) {
      for (const v of Object.values(values))
        if (v !== null && envelopeKeyVersion(v) !== this.version) throw new Error('wrong version');
      const row = this.rows[body.model].find((r) => r.id === id)!;
      if (!this.needsWork(mode, body.model, row)) continue;
      Object.assign(row, values);
      if (mode === 'migration' && (body.model === 'Family' || body.model === 'Child')) row['name'] = null;
      if (mode === 'migration' && body.model === 'Answer') row['answerText'] = null;
      changed++;
    }
    return { changed };
  };

  getJobAttachments = async (_org: string, mode: string) =>
    this.attachments
      .filter((a) =>
        mode === 'rotation'
          ? a.contentKeyVersion !== null && a.contentKeyVersion !== this.version
          : a.contentKeyVersion === null,
      )
      .map((a) => ({ id: a.id, caseId: 'c', mimeType: 'application/pdf', contentKeyVersion: a.contentKeyVersion }));

  getJobAttachmentContent = async (_org: string, _mode: string, id: string) =>
    this.attachments.find((a) => a.id === id)!.content;

  putJobAttachmentContent = async (_org: string, _mode: string, id: string, keyVersion: number, content: Uint8Array) => {
    if (!isBytesEnvelope(content) || parseBytesEnvelope(content).keyVersion !== this.version)
      throw new Error('bad content');
    Object.assign(this.attachments.find((a) => a.id === id)!, { content, contentKeyVersion: keyVersion });
  };
}

describe('ReencryptJobService', () => {
  let api: FakeJobApi;
  let job: ReencryptJobService;
  let crypto: CryptoService;
  let v1: VersionedKey;
  let v2: VersionedKey;
  const resolver = (v: number) => (v === 1 ? v1.key : v === 2 ? v2.key : undefined);

  beforeEach(async () => {
    api = new FakeJobApi();
    TestBed.configureTestingModule({ providers: [{ provide: KeyApiService, useValue: api }] });
    job = TestBed.inject(ReencryptJobService);
    crypto = TestBed.inject(CryptoService);
    v1 = { version: 1, key: await crypto.generateDataKey() };
    v2 = { version: 2, key: await crypto.generateDataKey() };

    api.rows = {
      Family: [{ id: 'f1', name: 'Muster', note: 'Notiz', adress: { city: 'Kiel' }, phone: null, additionalPhones: [], encrypted: null }],
      Child: [{ id: 'k1', name: 'Mia', lastName: null, gender: 'female', dateOfBirth: new Date('2025-01-01'), healthData: [], encrypted: null }],
      ContactDocumentation: [
        { id: 'd1', zusammenfassung: 'kurz', dokumentation: '' },
        { id: 'd2', zusammenfassung: null, dokumentation: null },
      ],
      Answer: [{ id: 'a1', caseFormResponseId: 'r1', questionId: 'q1', answerText: 'Antwort', answerEncrypted: null }],
    };
    api.attachments = [{ id: 'att1', content: new Uint8Array([1, 2, 3, 4]), contentKeyVersion: null }];
  });

  /** Decrypts a stored field with the given key. */
  const read = (model: EncryptedModel, row: Row, column: string, key: VersionedKey) =>
    crypto.decryptField(row[column], () => key.key, encryptionContext(model, row, column));

  it('migrates every plaintext row and attachment, then rotates all of it to the new key', async () => {
    const progress: number[] = [];
    await job.run('org', 'migration', v1, resolver, (p) => progress.push(p.done));

    const family = api.rows['Family'][0];
    expect(family['name']).toBeNull();
    expect(JSON.parse(await read('Family', family, 'encrypted', v1)).json.name).toBe('Muster');
    const doc = api.rows['ContactDocumentation'][0];
    expect(await read('ContactDocumentation', doc, 'zusammenfassung', v1)).toBe('kurz');
    expect(doc['dokumentation']).toBeNull();
    expect(api.rows['ContactDocumentation'][1]['zusammenfassung']).toBeNull();
    const answer = api.rows['Answer'][0];
    expect(JSON.parse(await read('Answer', answer, 'answerEncrypted', v1)).json.answerText).toBe('Antwort');
    expect(api.attachments[0].contentKeyVersion).toBe(1);
    expect(progress[progress.length - 1]).toBe(5);

    api.version = 2;
    await job.run('org', 'rotation', v2, resolver);

    expect(envelopeKeyVersion(family['encrypted'])).toBe(2);
    expect(JSON.parse(await read('Family', family, 'encrypted', v2)).json.name).toBe('Muster');
    expect(await read('ContactDocumentation', doc, 'zusammenfassung', v2)).toBe('kurz');
    expect(JSON.parse(await read('Answer', answer, 'answerEncrypted', v2)).json.answerText).toBe('Antwort');
    const content = await crypto.decryptBytes(api.attachments[0].content, () => v2.key, attachmentContentContext('att1'));
    expect(content).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect((await api.getJobStatus('org', 'rotation')).attachmentContents).toBe(0);
  });

  it('resumes an interrupted job without touching finished rows', async () => {
    const put = api.putJobRows;
    let calls = 0;
    api.putJobRows = async (...args: Parameters<typeof put>) => {
      if (++calls === 2) throw new Error('network');
      return put(...args);
    };
    await expectAsync(job.run('org', 'migration', v1, resolver)).toBeRejected();
    const migratedFamily = api.rows['Family'][0]['encrypted'];
    expect(migratedFamily).toBeTruthy();

    await job.run('org', 'migration', v1, resolver);
    expect(api.rows['Family'][0]['encrypted']).toBe(migratedFamily);
    expect(Object.values((await api.getJobStatus('org', 'migration')).rows).every((n) => n === 0)).toBeTrue();
  });

  it('stops instead of looping when the server keeps offering the same rows', async () => {
    api.putJobRows = async () => ({ changed: 0 });
    await expectAsync(job.run('org', 'migration', v1, resolver)).toBeRejectedWithError(/could not be updated/);
  });
});
