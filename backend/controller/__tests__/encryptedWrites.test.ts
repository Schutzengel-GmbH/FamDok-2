jest.mock('../../db', () => ({
  prisma: require('../../testUtils/prismaMock').createPrismaMock(),
}));
jest.mock('../../util/fileStorage', () => ({
  deleteStoredFile: jest.fn(),
  streamFile: jest.fn(),
  resolveStoragePath: jest.fn(),
}));

import fs from 'fs';
import os from 'os';
import path from 'path';
import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import {
  buildCase,
  buildCaseForm,
  buildCaseFormResponse,
  buildFamily,
  buildUser,
} from '../../testUtils/fixtures';
import { CaseController } from '../CaseController';
import { FamilyController } from '../familyController';
import { CaseFormResponseController } from '../CaseFormResponseController';
import { Role } from '../../../shared/generated/prisma/client';
import { BadRequestError } from '../../util/authUtils';
import { deleteStoredFile } from '../../util/fileStorage';
import { formatBytesEnvelope } from '../../../shared/utils/ciphertext';
import { CaseCreateRequest } from '../../../shared/api';

/**
 * The data controllers in an organisation that has set up its encryption (key version 3): only
 * ciphertext under the current version gets in, rows carry the ids the browser bound their
 * ciphertext to, and plaintext personal fields are refused.
 */
const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

const ORG = 'org-1';
const env = (v = 3) => `v1.${v}.AAECAwQFBgcICQoL.${'A'.repeat(30)}`;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

beforeEach(() => {
  for (const model of Object.values(prismaMock))
    if (typeof model === 'object') Object.values(model).forEach((fn: any) => fn.mockReset?.());
  prismaMock.$transaction.mockImplementation((arg: any) =>
    typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg)
  );
  prismaMock.organisation.findUnique.mockResolvedValue({ keyState: 'active', keyVersion: 3 });
});

describe('creating a case in an encrypted org', () => {
  const user = buildUser({ role: Role.User, organisationId: ORG });
  const request = (overrides: Record<string, any> = {}, family: Record<string, any> = {}) =>
    CaseCreateRequest.parse({
      id: uuid(1),
      startedAt: new Date(),
      specificMigrationBackground: env(),
      city: 'Flensburg',
      plz: '24937',
      family: {
        id: uuid(2),
        encrypted: env(),
        children: [{ id: uuid(3), encrypted: env() }],
        caregivers: [{ id: uuid(4), encrypted: env() }],
        ...family,
      },
      ...overrides,
    });

  it('stores the blobs under the browser ids, with the plaintext statistics copy', async () => {
    prismaMock.case.create.mockResolvedValue({});
    await CaseController.create(user, request());

    const data = prismaMock.case.create.mock.calls[0][0].data;
    expect(data.id).toBe(uuid(1));
    expect(data.city).toBe('Flensburg');
    expect(data.family.create.id).toBe(uuid(2));
    expect(data.family.create.encrypted).toBe(env());
    expect(data.family.create.children.createMany.data[0]).toEqual({ id: uuid(3), encrypted: env() });
  });

  it('refuses plaintext personal data', async () => {
    await expect(CaseController.create(user, request({}, { name: 'Muster' }))).rejects.toThrow(BadRequestError);
    await expect(
      CaseController.create(user, request({}, { children: [{ id: uuid(3), name: 'Kind', encrypted: env() }] }))
    ).rejects.toThrow(BadRequestError);
    await expect(
      CaseController.create(user, request({ specificMigrationBackground: 'Klartext' }))
    ).rejects.toThrow(BadRequestError);
    expect(prismaMock.case.create).not.toHaveBeenCalled();
  });

  it('refuses an outdated key version and missing ids or blobs', async () => {
    await expect(CaseController.create(user, request({}, { encrypted: env(2) }))).rejects.toThrow(BadRequestError);
    await expect(CaseController.create(user, request({ id: undefined }))).rejects.toThrow(BadRequestError);
    await expect(
      CaseController.create(user, request({}, { caregivers: [{ id: uuid(4) }] }))
    ).rejects.toThrow(BadRequestError);
  });
});

describe('updating a family in an encrypted org', () => {
  const user = buildUser({ role: Role.User, organisationId: ORG });
  const family = () =>
    buildFamily({
      organisationId: ORG,
      case: buildCase({ responsibleUsers: [{ id: user.id }] }),
    });

  it('clears leftover plaintext when it writes the blob', async () => {
    prismaMock.family.findUniqueOrThrow.mockResolvedValue(family());
    prismaMock.family.update.mockResolvedValue({});

    await FamilyController.update(user, 'f', {
      encrypted: env(),
      case: { specificMigrationBackground: env(), city: 'Kiel', plz: '24103' },
    });

    const data = prismaMock.family.update.mock.calls[0][0].data;
    expect(data).toEqual(
      expect.objectContaining({ encrypted: env(), name: null, phone: null, additionalPhones: [] })
    );
    expect(data.case.update).toEqual({ specificMigrationBackground: env(), city: 'Kiel', plz: '24103' });
    expect(prismaMock.case.updateMany).not.toHaveBeenCalled();
  });

  it('refuses plaintext in family, children and case fields', async () => {
    prismaMock.family.findUniqueOrThrow.mockResolvedValue(family());
    await expect(FamilyController.update(user, 'f', { note: 'Klartext' })).rejects.toThrow(BadRequestError);
    await expect(
      FamilyController.update(user, 'f', { children: [{ id: uuid(5), encrypted: env(), lastName: 'X' }] })
    ).rejects.toThrow(BadRequestError);
    await expect(
      FamilyController.update(user, 'f', { case: { specificMigrationBackground: 'Klartext' } })
    ).rejects.toThrow(BadRequestError);
  });

  it('takes health data only inside the child blob', async () => {
    prismaMock.family.findUniqueOrThrow.mockResolvedValue(family());
    prismaMock.family.update.mockResolvedValue({});
    await expect(
      FamilyController.updateChildHealthData(user, 'f', 'c', { healthData: [{ date: new Date() }] })
    ).rejects.toThrow(BadRequestError);

    await FamilyController.updateChildHealthData(user, 'f', 'c', { encrypted: env() });
    expect(prismaMock.family.update.mock.calls[0][0].data.children.update.data).toEqual(
      expect.objectContaining({ encrypted: env(), healthData: [], name: null })
    );
  });
});

describe('form responses in an encrypted org', () => {
  const user = buildUser({ role: Role.User, organisationId: ORG });

  function arrange(containsPersonalData: boolean) {
    const c = buildCase({ organisationId: ORG, responsibleUsers: [{ id: user.id }] });
    prismaMock.case.findUnique.mockResolvedValue(c);
    prismaMock.caseForm.findUnique.mockResolvedValue(
      buildCaseForm({ containsPersonalData, questions: [{ id: 'q1' }] })
    );
    prismaMock.caseFormResponse.count.mockResolvedValue(0);
    prismaMock.caseFormResponse.create.mockResolvedValue({});
    return c;
  }

  it('stores encrypted answers of personal forms under the browser response id', async () => {
    const c = arrange(true);
    await CaseFormResponseController.create(user, {
      id: uuid(9),
      caseId: c.id,
      caseFormId: 'form',
      answers: [{ questionId: 'q1', answerEncrypted: env() }],
    });
    const data = prismaMock.caseFormResponse.create.mock.calls[0][0].data;
    expect(data.id).toBe(uuid(9));
    expect(data.answers.createMany.data[0].answerEncrypted).toBe(env());
  });

  it('refuses plaintext answers for personal forms, and ciphertext for the others', async () => {
    const c = arrange(true);
    await expect(
      CaseFormResponseController.create(user, {
        id: uuid(9), caseId: c.id, caseFormId: 'form', answers: [{ questionId: 'q1', answerText: 'Klartext' }],
      })
    ).rejects.toThrow(BadRequestError);

    arrange(false);
    await expect(
      CaseFormResponseController.create(user, {
        id: uuid(9), caseId: c.id, caseFormId: 'form', answers: [{ questionId: 'q1', answerEncrypted: env() }],
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('clears leftover plaintext when an answer is updated encrypted', async () => {
    const response = buildCaseFormResponse({
      userId: user.id,
      caseForm: { containsPersonalData: true },
      case: { ...buildCase({ organisationId: ORG, responsibleUsers: [{ id: user.id }] }), family: null },
    });
    prismaMock.caseFormResponse.findUnique.mockResolvedValue(response);
    prismaMock.caseFormResponse.update.mockResolvedValue({});

    await CaseFormResponseController.update(user, response.id, {
      answers: [{ id: 'a1', questionId: 'q1', answerEncrypted: env() }],
    });

    const answers = prismaMock.caseFormResponse.update.mock.calls[0][0].data.answers;
    expect(answers.updateMany[0].data).toEqual(
      expect.objectContaining({ answerEncrypted: env(), answerText: null, answerSelectId: [] })
    );
  });
});

describe('attachments in an encrypted org', () => {
  const user = buildUser({ role: Role.User, organisationId: ORG });
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'famdok-att-'));
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  function upload(content: Uint8Array) {
    const file = path.join(dir, `f-${Math.random()}`);
    fs.writeFileSync(file, content);
    return {
      originalname: 'blob',
      filename: path.basename(file),
      path: file,
      mimetype: 'application/octet-stream',
      size: content.length,
    } as Express.Multer.File;
  }

  const encryptedContent = (v: number) =>
    formatBytesEnvelope(v, new Uint8Array(12), new Uint8Array(40).fill(1));

  beforeEach(() => {
    prismaMock.case.findUnique.mockResolvedValue(
      buildCase({ organisationId: ORG, responsibleUsers: [{ id: user.id }] })
    );
    prismaMock.caseAttachment.create.mockResolvedValue({});
  });

  const body = { id: uuid(7), filename: env(), note: env(), mimeType: 'application/pdf' };

  it('stores an encrypted upload with its real mime type and key version', async () => {
    await CaseController.createCaseAttachment(user, 'case', upload(encryptedContent(3)), body);
    expect(prismaMock.caseAttachment.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        id: uuid(7),
        filename: env(),
        mimeType: 'application/pdf',
        contentKeyVersion: 3,
      })
    );
  });

  it('refuses and deletes plaintext or outdated uploads', async () => {
    for (const content of [new TextEncoder().encode('%PDF-1.7 plain content of a file'), encryptedContent(2)]) {
      await expect(
        CaseController.createCaseAttachment(user, 'case', upload(content), body)
      ).rejects.toThrow(BadRequestError);
    }
    expect(deleteStoredFile).toHaveBeenCalledTimes(2);
    expect(prismaMock.caseAttachment.create).not.toHaveBeenCalled();
  });

  it('refuses a plaintext file name or a disallowed mime type', async () => {
    await expect(
      CaseController.createCaseAttachment(user, 'case', upload(encryptedContent(3)), { ...body, filename: 'scan.pdf' })
    ).rejects.toThrow(BadRequestError);
    await expect(
      CaseController.createCaseAttachment(user, 'case', upload(encryptedContent(3)), { ...body, mimeType: 'text/html' })
    ).rejects.toThrow(BadRequestError);
  });
});
