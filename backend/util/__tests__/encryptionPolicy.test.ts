jest.mock('../../db', () => ({
  prisma: require('../../testUtils/prismaMock').createPrismaMock(),
}));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import {
  assertAnswersWrite,
  assertBlobWrite,
  assertClientId,
  assertFieldWrite,
  encryptionPolicyFor,
} from '../encryptionPolicy';
import { BadRequestError } from '../authUtils';
import { requireOrgNotFrozen } from '../../middleware/orgFrozen';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;
const env = (v: number) => `v1.${v}.AAECAwQFBgcICQoL.${'A'.repeat(30)}`;
const active = { active: true, keyVersion: 2 };
const legacy = { active: false, keyVersion: 0 };

describe('encryptionPolicyFor', () => {
  it('is legacy without org, for unknown orgs and before setup', async () => {
    expect(await encryptionPolicyFor(null)).toEqual(legacy);
    prismaMock.organisation.findUnique.mockResolvedValueOnce(null);
    expect(await encryptionPolicyFor('o')).toEqual(legacy);
    prismaMock.organisation.findUnique.mockResolvedValueOnce({ keyState: 'uninitialized', keyVersion: 0 });
    expect(await encryptionPolicyFor('o')).toEqual(legacy);
  });

  it('is active with the org key version after setup', async () => {
    prismaMock.organisation.findUnique.mockResolvedValueOnce({ keyState: 'active', keyVersion: 2 });
    expect(await encryptionPolicyFor('o')).toEqual(active);
  });
});

describe('assertFieldWrite', () => {
  it('accepts current envelopes and null once active', () => {
    expect(() =>
      assertFieldWrite(active, 'ContactDocumentation', { dokumentation: env(2), zusammenfassung: null })
    ).not.toThrow();
  });

  it('rejects plaintext and outdated envelopes once active', () => {
    expect(() => assertFieldWrite(active, 'ContactDocumentation', { dokumentation: 'Klartext' })).toThrow(BadRequestError);
    expect(() => assertFieldWrite(active, 'Handover', { notes: env(1) })).toThrow(BadRequestError);
  });

  it('accepts plaintext but no envelopes before setup', () => {
    expect(() => assertFieldWrite(legacy, 'Zielvereinbarung', { description: 'Ziel' })).not.toThrow();
    expect(() => assertFieldWrite(legacy, 'Zielvereinbarung', { description: env(1) })).toThrow(BadRequestError);
  });
});

describe('assertBlobWrite', () => {
  it('requires the blob and no plaintext fields once active', () => {
    expect(() => assertBlobWrite(active, 'Family', { encrypted: env(2), additionalPhones: [] }, true)).not.toThrow();
    expect(() => assertBlobWrite(active, 'Family', { name: 'Muster', encrypted: env(2) }, true)).toThrow(BadRequestError);
    expect(() => assertBlobWrite(active, 'Child', { gender: 'female', encrypted: env(2) }, true)).toThrow(BadRequestError);
    expect(() => assertBlobWrite(active, 'Child', {}, true)).toThrow(BadRequestError);
    expect(() => assertBlobWrite(active, 'Child', {}, false)).not.toThrow();
  });

  it('refuses a blob before setup', () => {
    expect(() => assertBlobWrite(legacy, 'Caregiver', { name: 'A' }, true)).not.toThrow();
    expect(() => assertBlobWrite(legacy, 'Caregiver', { encrypted: env(1) }, true)).toThrow(BadRequestError);
  });
});

describe('assertAnswersWrite', () => {
  it('requires encrypted answers for personal forms of active orgs', () => {
    expect(() => assertAnswersWrite(active, true, [{ answerEncrypted: env(2), answerSelectId: [] }])).not.toThrow();
    expect(() => assertAnswersWrite(active, true, [{ answerText: 'Klartext' }])).toThrow(BadRequestError);
    expect(() => assertAnswersWrite(active, true, [{ answerSelectId: [1] }])).toThrow(BadRequestError);
  });

  it('refuses answerEncrypted everywhere else', () => {
    expect(() => assertAnswersWrite(active, false, [{ answerText: 'ok' }])).not.toThrow();
    expect(() => assertAnswersWrite(active, false, [{ answerEncrypted: env(2) }])).toThrow(BadRequestError);
    expect(() => assertAnswersWrite(legacy, true, [{ answerEncrypted: env(2) }])).toThrow(BadRequestError);
  });
});

describe('assertClientId', () => {
  it('requires a UUID from the browser once active', () => {
    expect(() => assertClientId(active, undefined, 'Family')).toThrow(BadRequestError);
    expect(() => assertClientId(active, 'not-a-uuid', 'Family')).toThrow(BadRequestError);
    expect(() => assertClientId(active, '11111111-1111-4111-8111-111111111111', 'Family')).not.toThrow();
    expect(() => assertClientId(legacy, undefined, 'Family')).not.toThrow();
  });
});

describe('requireOrgNotFrozen', () => {
  function run(keyState: string | undefined) {
    const res: any = { status: jest.fn(() => res), json: jest.fn() };
    const next = jest.fn();
    requireOrgNotFrozen(
      { user: keyState ? { organisation: { keyState } } : { organisation: null } } as any,
      res,
      next
    );
    return { res, next };
  }

  it('passes active and uninitialized orgs and users without org', () => {
    for (const s of ['active', 'uninitialized', undefined]) expect(run(s).next).toHaveBeenCalled();
  });

  it('answers 423 for frozen and rotating orgs', () => {
    for (const s of ['frozen', 'rotating']) {
      const { res, next } = run(s);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(423);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ keyState: s }));
    }
  });
});
