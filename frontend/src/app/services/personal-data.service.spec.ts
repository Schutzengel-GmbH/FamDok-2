import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { PersonalDataService, UNREADABLE } from './personal-data.service';
import { KeySessionService } from './key-session.service';
import { CryptoService, UnlockedDataKey } from './crypto.service';
import { isEnvelope, isBytesEnvelope } from '../../../../shared/utils/ciphertext';
import type { CaseCreateRequest } from '../../../../shared/api';

const UUID = /^[0-9a-f-]{36}$/;

describe('PersonalDataService', () => {
  let service: PersonalDataService;
  let crypto: CryptoService;
  let key: UnlockedDataKey;
  let active: ReturnType<typeof signal<boolean>>;
  let unlocked: ReturnType<typeof signal<boolean>>;

  beforeEach(async () => {
    active = signal(true);
    unlocked = signal(true);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: KeySessionService,
          useFactory: () => ({
            encryptionActive: computed(() => active()),
            currentKey: () => key,
            keyResolver: (v: number) => (unlocked() && v === key.version ? key.key : undefined),
          }),
        },
      ],
    });
    service = TestBed.inject(PersonalDataService);
    crypto = TestBed.inject(CryptoService);
    key = { version: 4, key: await crypto.generateDataKey(), fingerprint: '' };
  });

  const createRequest = (): CaseCreateRequest => ({
    startedAt: new Date('2026-01-05'),
    migrationBackground: true,
    specificMigrationBackground: 'Polen',
    family: {
      name: 'Muster',
      note: 'kommt dienstags',
      phone: '0461 123',
      additionalPhones: ['0170 1'],
      adress: { street: 'Hafenstr.', number: '1', plz: '24937', city: 'Flensburg' },
      children: [{ name: 'Mia', gender: 'female', dateOfBirth: new Date('2025-03-01'), healthData: [] }],
      caregivers: [{ name: 'Anna', relation: 'mother', gender: 'female', dateOfBirth: new Date('1990-01-01') }],
    },
  });

  /** What the server would answer for a case created from the prepared request. */
  function asStoredCase(req: CaseCreateRequest) {
    const { children = [], caregivers = [], ...family } = req.family;
    return {
      id: req.id,
      city: req.city,
      plz: req.plz,
      specificMigrationBackground: req.specificMigrationBackground,
      zielvereinbarungen: [],
      contactDocumentation: [],
      family: { ...family, children, caregiver: caregivers, case: null },
    };
  }

  it('sends a new case without any personal plaintext, with browser ids and the statistics copy', async () => {
    const prepared = await service.prepareCaseCreate(createRequest());
    const json = JSON.stringify(prepared);

    for (const secret of ['Muster', 'dienstags', '0461', 'Hafenstr', 'Polen', 'Mia', 'Anna', 'mother'])
      expect(json).not.toContain(secret);
    expect(prepared.id).toMatch(UUID);
    expect(prepared.family.id).toMatch(UUID);
    expect(prepared.family.children![0].id).toMatch(UUID);
    expect(isEnvelope(prepared.family.encrypted)).toBeTrue();
    expect(isEnvelope(prepared.specificMigrationBackground)).toBeTrue();
    expect(prepared.city).toBe('Flensburg');
    expect(prepared.plz).toBe('24937');
  });

  it('decrypts a whole case payload back to the plaintext the components expect', async () => {
    const stored = asStoredCase(await service.prepareCaseCreate(createRequest()));
    const c = await service.decrypt('Case', stored);

    expect(c.specificMigrationBackground).toBe('Polen');
    expect(c.family.name).toBe('Muster');
    expect(c.family.adress).toEqual({ street: 'Hafenstr.', number: '1', plz: '24937', city: 'Flensburg' });
    expect(c.family.children[0].name).toBe('Mia');
    expect(c.family.children[0].dateOfBirth).toEqual(new Date('2025-03-01'));
    expect(c.family.caregiver[0].relation).toBe('mother');
  });

  it('shows ciphertext moved to another row as unreadable', async () => {
    const stored = asStoredCase(await service.prepareCaseCreate(createRequest()));
    const moved = { ...stored, family: { ...stored.family, id: globalThis.crypto.randomUUID() } };
    const c = await service.decrypt('Case', moved);
    expect(c.family.name).toBe(UNREADABLE);
  });

  it('shows everything as unreadable while locked', async () => {
    const stored = asStoredCase(await service.prepareCaseCreate(createRequest()));
    unlocked.set(false);
    const c = await service.decrypt('Case', stored);
    expect(c.family.name).toBe(UNREADABLE);
    expect(c.specificMigrationBackground).toBe(UNREADABLE);
  });

  it('merges a partial family update with the current family into one blob', async () => {
    const stored = asStoredCase(await service.prepareCaseCreate(createRequest()));
    const current = await service.decrypt('Family', { ...stored.family, case: { id: stored.id } } as any);

    const update = await service.prepareFamilyUpdate(current, { note: 'neu' });
    const after = await service.decrypt('Family', { id: current.id, encrypted: update.encrypted } as any);

    expect(JSON.stringify(update)).not.toContain('neu');
    expect(after.note).toBe('neu');
    expect(after.name).toBe('Muster');
    expect(after.phone).toBe('0461 123');
  });

  it('copies a changed address into the statistics fields of the case', async () => {
    const stored = asStoredCase(await service.prepareCaseCreate(createRequest()));
    const current = await service.decrypt('Family', { ...stored.family, case: { id: stored.id } } as any);
    const update = await service.prepareFamilyUpdate(current, {
      adress: { street: 'X', number: '2', plz: '24103', city: 'Kiel' },
    });
    expect(update.case).toEqual(jasmine.objectContaining({ city: 'Kiel', plz: '24103' }));
    expect(update.adress).toBeUndefined();
  });

  it('refuses to re-encrypt a family it could not decrypt', async () => {
    const stored = asStoredCase(await service.prepareCaseCreate(createRequest()));
    unlocked.set(false);
    const current = await service.decrypt('Family', { ...stored.family, case: { id: stored.id } } as any);
    unlocked.set(true);
    await expectAsync(service.prepareFamilyUpdate(current, { note: 'neu' })).toBeRejected();
    await expectAsync(service.prepareHealthData(current.children[0], [])).toBeRejected();
  });

  it('encrypts an empty description of a Zielvereinbarung, whose column can not be null', async () => {
    const ziel = await service.prepareZiel('z1', { description: '' });
    expect(isEnvelope(ziel.description)).toBeTrue();
    const back = await service.decrypt('Zielvereinbarung', { id: 'z1', description: ziel.description });
    expect(back.description).toBe('');
  });

  it('encrypts answers of personal forms bound to response and question, keeps empty ones empty', async () => {
    const answers: any[] = await service.prepareAnswers('resp-1', true, [
      { questionId: 'q1', answerText: 'vertraulich' },
      { questionId: 'q2', answerSelectId: [] },
    ] as any[]);
    expect(isEnvelope(answers[0].answerEncrypted)).toBeTrue();
    expect(answers[0].answerText).toBeUndefined();
    expect(answers[1].answerEncrypted).toBeNull();

    const response: any = await service.decrypt('CaseFormResponse', {
      id: 'resp-1',
      answers: [{ id: 'a', caseFormResponseId: 'resp-1', questionId: 'q1', answerEncrypted: answers[0].answerEncrypted }],
    });
    expect(response.answers[0].answerText).toBe('vertraulich');

    const swapped: any = await service.decrypt('CaseFormResponse', {
      id: 'resp-1',
      answers: [{ id: 'a', caseFormResponseId: 'resp-1', questionId: 'q2', answerEncrypted: answers[0].answerEncrypted }],
    });
    expect(swapped.answers[0].answerText).toBe(UNREADABLE);
  });

  it('leaves answers of non-personal forms alone', async () => {
    const answers = [{ questionId: 'q1', answerInt: 3 }];
    expect(await service.prepareAnswers('r', false, answers)).toBe(answers);
  });

  it('turns empty free text into null, so the server can still see unfinished documentation', async () => {
    const doc = await service.prepareContactDocumentation('d1', { zusammenfassung: '', dokumentation: 'Text' });
    expect(doc.zusammenfassung).toBeNull();
    expect(isEnvelope(doc.dokumentation)).toBeTrue();
  });

  it('round-trips an attachment', async () => {
    const file = new File([new Uint8Array([37, 80, 68, 70, 1, 2, 3])], 'Einverständnis.pdf', {
      type: 'application/pdf',
    });
    const prepared = await service.prepareAttachment(file, 'unterschrieben');
    expect(prepared.encrypted).toBeTrue();
    expect(prepared.mimeType).toBe('application/pdf');
    expect(isBytesEnvelope(new Uint8Array(await prepared.content.arrayBuffer()))).toBeTrue();

    const meta = await service.decrypt('CaseAttachment', {
      id: prepared.id,
      filename: prepared.filename,
      note: prepared.note,
    });
    expect(meta.filename).toBe('Einverständnis.pdf');
    expect(meta.note).toBe('unterschrieben');

    const content = await service.decryptAttachmentContent(
      { id: prepared.id, mimeType: 'application/pdf', contentKeyVersion: 4 },
      prepared.content,
    );
    expect(new Uint8Array(await content.arrayBuffer())).toEqual(new Uint8Array([37, 80, 68, 70, 1, 2, 3]));
  });

  it('passes everything through before the org has set up its encryption', async () => {
    active.set(false);
    const req = createRequest();
    const sent: unknown[] = [];
    service.send(req, () => Promise.reject('must not prepare'), (body) => {
      sent.push(body);
      return { subscribe: () => {} } as any;
    });
    expect(sent).toEqual([req]);
    expect(await service.prepareAnswers('r', true, [{ questionId: 'q', answerText: 'x' }])).toEqual([
      { questionId: 'q', answerText: 'x' },
    ]);
    const plain = { id: 'f', name: 'Muster', children: [] };
    expect(await service.decrypt('Family', plain)).toEqual(plain);
  });

  it('passes plaintext rows from before the migration through', async () => {
    const legacy = { id: 'f', name: 'Alt', encrypted: null, children: [{ id: 'c', name: 'Kind', encrypted: null }] };
    const f = await service.decrypt('Family', legacy as any);
    expect(f.name).toBe('Alt');
    expect(f.children[0].name).toBe('Kind');
  });
});
