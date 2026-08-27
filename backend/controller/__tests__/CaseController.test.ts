jest.mock('../../db', () => ({ prisma: require('../../testUtils/prismaMock').createPrismaMock() }));
jest.mock('../../util/pdfService', () => ({
  PDFService: { contactDocumentationPDF: jest.fn() },
}));
jest.mock('../../util/fileStorage', () => ({
  streamFile: jest.fn(),
  deleteStoredFile: jest.fn(),
}));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import {
  buildCase,
  buildCaseAttachment,
  buildCaseForm,
  buildCaseFormResponse,
  buildContactDocumentation,
  buildFamily,
  buildHandover,
  buildSetting,
  buildUser,
  buildZielvereinbarung,
} from '../../testUtils/fixtures';
import { CaseController } from '../CaseController';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../util/authUtils';
import { PDFService } from '../../util/pdfService';
import { streamFile, deleteStoredFile } from '../../util/fileStorage';
import { Role } from '../../../shared/generated/prisma/client';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

function caseFor(user: { id: string }, overrides: Record<string, any> = {}) {
  return buildCase({ responsibleUsers: [{ id: user.id }], ...overrides });
}

function multerFile(overrides: Record<string, any> = {}): Express.Multer.File {
  return {
    originalname: 'scan.pdf',
    filename: 'stored-key.pdf',
    mimetype: 'application/pdf',
    size: 42,
    ...overrides,
  } as Express.Multer.File;
}

describe('CaseController', () => {
  describe('getAll', () => {
    it('returns cases visible to the user', async () => {
      const user = buildUser({ role: Role.Admin });
      const cases = [caseFor(user)];
      prismaMock.case.findMany.mockResolvedValue(cases);

      const result = await CaseController.getAll(user, { organisationId: 'org-1' } as any);

      expect(result).toBe(cases);
    });

    it('throws ForbiddenError when some cases are not visible', async () => {
      const user = buildUser({ role: Role.User });
      const cases = [caseFor({ id: 'someone-else' })];
      prismaMock.case.findMany.mockResolvedValue(cases);

      await expect(CaseController.getAll(user)).rejects.toThrow(ForbiddenError);
    });

    it('throws a validation error for an unknown where field', async () => {
      const user = buildUser({ role: Role.Admin });

      await expect(
        CaseController.getAll(user, { notARealField: true } as any)
      ).rejects.toThrow();
      expect(prismaMock.case.findMany).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('returns a visible case', async () => {
      const user = buildUser({ role: Role.Admin });
      const c = caseFor(user);
      prismaMock.case.findUnique.mockResolvedValue(c);

      const result = await CaseController.get(user, c.id);

      expect(result).toBe(c);
    });

    it('throws NotFoundError when missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(CaseController.get(user, 'missing')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when not visible', async () => {
      const user = buildUser({ role: Role.User });
      const c = caseFor({ id: 'someone-else' });
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(CaseController.get(user, c.id)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('create', () => {
    function validCreateData(user: any) {
      return {
        startedAt: new Date('2026-01-01'),
        createdBy: { connect: { id: user.id } },
        organisation: { connect: { id: user.organisationId } },
        family: { connect: { id: 'family-1' } },
      } as any;
    }

    it('creates a case when the user owns org/createdBy', async () => {
      const user = buildUser({ role: Role.User });
      const created = caseFor(user);
      prismaMock.case.create.mockResolvedValue(created);

      const result = await CaseController.create(user, validCreateData(user));

      expect(result).toBe(created);
    });

    it('throws ForbiddenError when creating for a different organisation', async () => {
      const user = buildUser({ role: Role.User, organisationId: 'org-1' });
      const data = validCreateData(user);
      data.organisation = { connect: { id: 'org-2' } };

      await expect(CaseController.create(user, data)).rejects.toThrow(ForbiddenError);
      expect(prismaMock.case.create).not.toHaveBeenCalled();
    });

    it('throws a validation error when required fields are missing', async () => {
      const user = buildUser({ role: Role.User });

      await expect(CaseController.create(user, { startedAt: new Date() } as any)).rejects.toThrow();
    });
  });

  describe('updateCase', () => {
    it('updates a case the user can edit', async () => {
      const user = buildUser({ role: Role.Admin });
      const c = caseFor(user);
      prismaMock.case.findUnique.mockResolvedValue(c);
      const updated = { ...c, city: 'Berlin' };
      prismaMock.case.update.mockResolvedValue(updated);

      const result = await CaseController.updateCase(user, c.id, { city: 'Berlin' });

      expect(result).toBe(updated);
    });

    it('throws NotFoundError when missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(CaseController.updateCase(user, 'missing', {})).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the user cannot edit the case', async () => {
      const user = buildUser({ role: Role.User });
      const c = caseFor({ id: 'someone-else' });
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(CaseController.updateCase(user, c.id, {})).rejects.toThrow(ForbiddenError);
      expect(prismaMock.case.update).not.toHaveBeenCalled();
    });
  });

  describe('addZiel', () => {
    const zielInput = {
      startedAt: new Date('2026-01-01'),
      finishBy: new Date('2026-02-01'),
      topic: 'Topic',
      description: 'Description',
    };

    it('adds a zielvereinbarung to an editable case', async () => {
      const user = buildUser({ role: Role.Admin });
      const c = caseFor(user);
      prismaMock.case.findUnique.mockResolvedValue(c);
      const updated = { ...c };
      prismaMock.case.update.mockResolvedValue(updated);

      const result = await CaseController.addZiel(user, c.id, zielInput);

      expect(result).toBe(updated);
      const updateCall = prismaMock.case.update.mock.calls[0][0];
      expect(updateCall.data.zielvereinbarungen.create.createdBy).toEqual({
        connect: { id: user.id },
      });
    });

    it('throws NotFoundError when the case is missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(CaseController.addZiel(user, 'missing', zielInput)).rejects.toThrow(
        NotFoundError
      );
    });

    it('throws ForbiddenError when the user cannot edit the case', async () => {
      const user = buildUser({ role: Role.User });
      const c = caseFor({ id: 'someone-else' });
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(CaseController.addZiel(user, c.id, zielInput)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('updateZiel', () => {
    it('updates a zielvereinbarung on an editable case', async () => {
      const user = buildUser({ role: Role.Admin });
      const c = caseFor(user);
      prismaMock.case.findFirst.mockResolvedValue(c);
      const zv = buildZielvereinbarung();
      prismaMock.zielvereinbarung.update.mockResolvedValue(zv);

      const result = await CaseController.updateZiel(user, zv.id, { topic: 'New' });

      expect(result).toBe(zv);
    });

    it('throws NotFoundError when no case owns that zielvereinbarung', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.case.findFirst.mockResolvedValue(null);

      await expect(CaseController.updateZiel(user, 'missing', {})).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the user cannot edit the case', async () => {
      const user = buildUser({ role: Role.User });
      const c = caseFor({ id: 'someone-else' });
      prismaMock.case.findFirst.mockResolvedValue(c);

      await expect(CaseController.updateZiel(user, 'zv-1', {})).rejects.toThrow(ForbiddenError);
      expect(prismaMock.zielvereinbarung.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes an editable case', async () => {
      const user = buildUser({ role: Role.Admin });
      const c = caseFor(user);
      prismaMock.case.findUnique.mockResolvedValue(c);
      prismaMock.case.delete.mockResolvedValue(c);

      const result = await CaseController.delete(user, c.id);

      expect(result).toBe(c);
    });

    it('throws NotFoundError when missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(CaseController.delete(user, 'missing')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the user cannot edit the case', async () => {
      const user = buildUser({ role: Role.User });
      const c = caseFor({ id: 'someone-else' });
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(CaseController.delete(user, c.id)).rejects.toThrow(ForbiddenError);
      expect(prismaMock.case.delete).not.toHaveBeenCalled();
    });
  });

  describe('deleteZiel', () => {
    it('deletes a zielvereinbarung on an editable case', async () => {
      const user = buildUser({ role: Role.Admin });
      const c = caseFor(user);
      prismaMock.case.findFirst.mockResolvedValue(c);
      prismaMock.zielvereinbarung.delete.mockResolvedValue({});

      await CaseController.deleteZiel(user, 'zv-1');

      expect(prismaMock.zielvereinbarung.delete).toHaveBeenCalledWith({ where: { id: 'zv-1' } });
    });

    it('throws NotFoundError when no case owns that zielvereinbarung', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.case.findFirst.mockResolvedValue(null);

      await expect(CaseController.deleteZiel(user, 'missing')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the user cannot edit the case', async () => {
      const user = buildUser({ role: Role.User });
      const c = caseFor({ id: 'someone-else' });
      prismaMock.case.findFirst.mockResolvedValue(c);

      await expect(CaseController.deleteZiel(user, 'zv-1')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getContactDocumentations', () => {
    it('returns docs when the user can see every related case', async () => {
      const user = buildUser({ role: Role.Admin });
      const doc = buildContactDocumentation();
      prismaMock.contactDocumentation.findMany.mockResolvedValue([doc]);
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(caseFor(user, { id: doc.caseId }));

      const result = await CaseController.getContactDocumentations(user);

      expect(result).toEqual([doc]);
    });

    it('throws ForbiddenError (and awaits the check) when a related case is not visible', async () => {
      const user = buildUser({ role: Role.User });
      const doc = buildContactDocumentation();
      prismaMock.contactDocumentation.findMany.mockResolvedValue([doc]);
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(
        caseFor({ id: 'someone-else' }, { id: doc.caseId })
      );

      await expect(CaseController.getContactDocumentations(user)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getMyContactDocumentations', () => {
    it('scopes the filter to documentation created by the user', async () => {
      const user = buildUser({ role: Role.Admin });
      const doc = buildContactDocumentation({ userId: user.id });
      prismaMock.contactDocumentation.findMany.mockResolvedValue([doc]);
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(caseFor(user, { id: doc.caseId }));

      const result = await CaseController.getMyContactDocumentations(user);

      expect(result).toEqual([doc]);
      expect(prismaMock.contactDocumentation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { createdBy: { id: user.id } } })
      );
    });

    it('throws ForbiddenError when a related case is not visible', async () => {
      const user = buildUser({ role: Role.User });
      const doc = buildContactDocumentation();
      prismaMock.contactDocumentation.findMany.mockResolvedValue([doc]);
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(
        caseFor({ id: 'someone-else' }, { id: doc.caseId })
      );

      await expect(CaseController.getMyContactDocumentations(user)).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('getContactDocumentation', () => {
    it('returns a visible document', async () => {
      const user = buildUser({ role: Role.Admin });
      const doc = buildContactDocumentation();
      prismaMock.contactDocumentation.findUnique.mockResolvedValue(doc);
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(caseFor(user, { id: doc.caseId }));

      const result = await CaseController.getContactDocumentation(user, doc.id);

      expect(result).toBe(doc);
    });

    it('throws NotFoundError when missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.contactDocumentation.findUnique.mockResolvedValue(null);

      await expect(CaseController.getContactDocumentation(user, 'missing')).rejects.toThrow(
        NotFoundError
      );
    });

    it('throws ForbiddenError when the related case is not visible', async () => {
      const user = buildUser({ role: Role.User });
      const doc = buildContactDocumentation();
      prismaMock.contactDocumentation.findUnique.mockResolvedValue(doc);
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(
        caseFor({ id: 'someone-else' }, { id: doc.caseId })
      );

      await expect(CaseController.getContactDocumentation(user, doc.id)).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('getContactDocumentationPDF', () => {
    it('renders the PDF for a visible document', async () => {
      const user = buildUser({ role: Role.Admin });
      const doc = buildContactDocumentation();
      prismaMock.contactDocumentation.findUnique.mockResolvedValue(doc);
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(caseFor(user, { id: doc.caseId }));
      const buffer = Buffer.from('pdf');
      (PDFService.contactDocumentationPDF as jest.Mock).mockResolvedValue(buffer);

      const result = await CaseController.getContactDocumentationPDF(user, doc.id);

      expect(result).toBe(buffer);
      expect(PDFService.contactDocumentationPDF).toHaveBeenCalledWith(doc);
    });

    it('throws NotFoundError when missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.contactDocumentation.findUnique.mockResolvedValue(null);

      await expect(CaseController.getContactDocumentationPDF(user, 'missing')).rejects.toThrow(
        NotFoundError
      );
    });

    it('throws ForbiddenError when the related case is not visible', async () => {
      const user = buildUser({ role: Role.User });
      const doc = buildContactDocumentation();
      prismaMock.contactDocumentation.findUnique.mockResolvedValue(doc);
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(
        caseFor({ id: 'someone-else' }, { id: doc.caseId })
      );

      await expect(CaseController.getContactDocumentationPDF(user, doc.id)).rejects.toThrow(
        ForbiddenError
      );
      expect(PDFService.contactDocumentationPDF).not.toHaveBeenCalled();
    });
  });

  describe('getContactDocumentationForCase', () => {
    it('returns documentation for a visible case', async () => {
      const user = buildUser({ role: Role.Admin });
      const c = caseFor(user);
      prismaMock.case.findUnique.mockResolvedValue(c);
      const docs = [buildContactDocumentation({ caseId: c.id })];
      prismaMock.contactDocumentation.findMany.mockResolvedValue(docs);

      const result = await CaseController.getContactDocumentationForCase(user, c.id);

      expect(result).toBe(docs);
    });

    it('throws NotFoundError when the case is missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(
        CaseController.getContactDocumentationForCase(user, 'missing')
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the case is not visible', async () => {
      const user = buildUser({ role: Role.User });
      const c = caseFor({ id: 'someone-else' });
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(CaseController.getContactDocumentationForCase(user, c.id)).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('getLatestContactDocumentation', () => {
    it('defaults to the 5 latest entries', async () => {
      const user = buildUser({ role: Role.Admin });
      const c = caseFor(user);
      prismaMock.case.findUnique.mockResolvedValue(c);
      prismaMock.contactDocumentation.findMany.mockResolvedValue([]);

      await CaseController.getLatestContactDocumentation(user, c.id);

      expect(prismaMock.contactDocumentation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          orderBy: { date: { sort: 'desc', nulls: 'last' } },
        })
      );
    });

    it('honors a custom limit', async () => {
      const user = buildUser({ role: Role.Admin });
      const c = caseFor(user);
      prismaMock.case.findUnique.mockResolvedValue(c);
      prismaMock.contactDocumentation.findMany.mockResolvedValue([]);

      await CaseController.getLatestContactDocumentation(user, c.id, 2);

      expect(prismaMock.contactDocumentation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 2 })
      );
    });

    it('throws ForbiddenError when the case is not visible', async () => {
      const user = buildUser({ role: Role.User });
      const c = caseFor({ id: 'someone-else' });
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(CaseController.getLatestContactDocumentation(user, c.id)).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('createContactDocumentation', () => {
    it('creates documentation for an editable case', async () => {
      const user = buildUser({ role: Role.Admin });
      const c = caseFor(user);
      prismaMock.case.findUnique.mockResolvedValue(c);
      const created = buildContactDocumentation({ caseId: c.id });
      prismaMock.contactDocumentation.create.mockResolvedValue(created);

      const result = await CaseController.createContactDocumentation(user, c.id, {
        date: new Date(),
        duration: 30,
        artDerBetreuung: 'Telefon',
      } as any);

      expect(result).toBe(created);
      const createCall = prismaMock.contactDocumentation.create.mock.calls[0][0];
      expect(createCall.data.createdBy).toEqual({ connect: { id: user.id } });
    });

    it('throws NotFoundError when the case is missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(
        CaseController.createContactDocumentation(user, 'missing', {} as any)
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the user cannot edit the case', async () => {
      const user = buildUser({ role: Role.User });
      const c = caseFor({ id: 'someone-else' });
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(
        CaseController.createContactDocumentation(user, c.id, {} as any)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('updateContactDocumentation', () => {
    it('updates documentation on an editable case', async () => {
      const user = buildUser({ role: Role.Admin });
      const doc = buildContactDocumentation();
      prismaMock.contactDocumentation.findUnique.mockResolvedValue(doc);
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(caseFor(user, { id: doc.caseId }));
      const updated = { ...doc, duration: 45 };
      prismaMock.contactDocumentation.update.mockResolvedValue(updated);

      const result = await CaseController.updateContactDocumentation(user, doc.id, {
        duration: 45,
      } as any);

      expect(result).toBe(updated);
    });

    it('throws ForbiddenError when the user cannot edit the case', async () => {
      const user = buildUser({ role: Role.User });
      const doc = buildContactDocumentation();
      prismaMock.contactDocumentation.findUnique.mockResolvedValue(doc);
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(
        caseFor({ id: 'someone-else' }, { id: doc.caseId })
      );

      await expect(
        CaseController.updateContactDocumentation(user, doc.id, {} as any)
      ).rejects.toThrow(ForbiddenError);
      expect(prismaMock.contactDocumentation.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteContactDocumentation', () => {
    it('deletes documentation on an editable case', async () => {
      const user = buildUser({ role: Role.Admin });
      const doc = buildContactDocumentation();
      prismaMock.contactDocumentation.findUnique.mockResolvedValue(doc);
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(caseFor(user, { id: doc.caseId }));
      prismaMock.contactDocumentation.delete.mockResolvedValue(doc);

      const result = await CaseController.deleteContactDocumentation(user, doc.id);

      expect(result).toBe(doc);
    });

    it('throws ForbiddenError when the user cannot edit the case', async () => {
      const user = buildUser({ role: Role.User });
      const doc = buildContactDocumentation();
      prismaMock.contactDocumentation.findUnique.mockResolvedValue(doc);
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(
        caseFor({ id: 'someone-else' }, { id: doc.caseId })
      );

      await expect(CaseController.deleteContactDocumentation(user, doc.id)).rejects.toThrow(
        ForbiddenError
      );
      expect(prismaMock.contactDocumentation.delete).not.toHaveBeenCalled();
    });
  });

  describe('getHandovers', () => {
    it('returns handovers with resolved added/removed users', async () => {
      const user = buildUser({ role: Role.Admin });
      const c = caseFor(user);
      prismaMock.case.findUnique.mockResolvedValue(c);
      const addedUser = buildUser();
      const removedUser = buildUser();
      const handover = buildHandover({
        caseId: c.id,
        addedIds: [addedUser.id],
        removedIds: [removedUser.id],
      });
      prismaMock.handover.findMany.mockResolvedValue([handover]);
      prismaMock.user.findMany.mockResolvedValue([addedUser, removedUser]);

      const result = await CaseController.getHandovers(user, c.id);

      expect(result).toEqual([
        {
          ...handover,
          notes: null,
          added: [addedUser],
          removed: [removedUser],
        },
      ]);
      expect(prismaMock.handover.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 })
      );
    });

    it('throws NotFoundError when the case is missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(CaseController.getHandovers(user, 'missing')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the case is not visible', async () => {
      const user = buildUser({ role: Role.User });
      const c = caseFor({ id: 'someone-else' });
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(CaseController.getHandovers(user, c.id)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('handover', () => {
    it('reassigns responsible users and records the handover', async () => {
      const initiator = buildUser({ role: Role.Admin });
      const oldUser = buildUser();
      const newUser = buildUser();
      const c = buildCase({ responsibleUsers: [{ id: oldUser.id }] });
      prismaMock.case.findUnique.mockResolvedValue(c);
      const updated = { ...c };
      prismaMock.case.update.mockResolvedValue(updated);
      prismaMock.handover.create.mockResolvedValue({});

      const handoverInput = buildHandover({
        caseId: c.id,
        addedIds: [newUser.id],
        removedIds: [oldUser.id],
      });

      const result = await CaseController.handover(initiator, handoverInput as any);

      expect(result).toBe(updated);
      expect(prismaMock.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            responsibleUsers: {
              disconnect: [{ id: oldUser.id }],
              connect: [{ id: newUser.id }],
            },
          },
        })
      );
      expect(prismaMock.handover.create).toHaveBeenCalled();
    });

    it('throws NotFoundError when the case is missing', async () => {
      const initiator = buildUser({ role: Role.Admin });
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(
        CaseController.handover(initiator, buildHandover() as any)
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the handover would leave no responsible users', async () => {
      const initiator = buildUser({ role: Role.Admin });
      const oldUser = buildUser();
      const c = buildCase({ responsibleUsers: [{ id: oldUser.id }] });
      prismaMock.case.findUnique.mockResolvedValue(c);

      const handoverInput = buildHandover({
        caseId: c.id,
        addedIds: [],
        removedIds: [oldUser.id],
      });

      await expect(
        CaseController.handover(initiator, handoverInput as any)
      ).rejects.toThrow(ForbiddenError);
      expect(prismaMock.case.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when the initiator is not responsible and not privileged', async () => {
      const initiator = buildUser({ role: Role.User });
      const oldUser = buildUser();
      const newUser = buildUser();
      const c = buildCase({ responsibleUsers: [{ id: oldUser.id }] });
      prismaMock.case.findUnique.mockResolvedValue(c);

      const handoverInput = buildHandover({
        caseId: c.id,
        addedIds: [newUser.id],
        removedIds: [],
      });

      await expect(
        CaseController.handover(initiator, handoverInput as any)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('closeCase', () => {
    it('sets the closedAt date and leaves personalDataDueAt null when no retention setting is configured', async () => {
      const user = buildUser({ role: Role.Admin });
      const closedAt = new Date('2026-03-01');
      const c = caseFor(user);
      prismaMock.case.findUnique.mockResolvedValue(c);
      prismaMock.setting.findUnique.mockResolvedValue(null);
      const updated = buildCase({ closedAt });
      prismaMock.case.update.mockResolvedValue(updated);

      const result = await CaseController.closeCase(user, c.id, closedAt);

      expect(result).toBe(updated);
      expect(prismaMock.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: c.id },
          data: { closedAt, personalDataDueAt: null },
        })
      );
    });

    it('computes personalDataDueAt from now() + retention days, not from closedAt', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-26T00:00:00.000Z'));
      const user = buildUser({ role: Role.Admin });
      // a backdated closedAt - the due date must NOT be derived from this
      const closedAt = new Date('2026-08-01T00:00:00.000Z');
      const c = caseFor(user);
      prismaMock.case.findUnique.mockResolvedValue(c);
      prismaMock.setting.findUnique.mockResolvedValue(
        buildSetting({ name: 'personal_data_retention_days', value: '30' })
      );
      prismaMock.case.update.mockResolvedValue(buildCase({ closedAt }));

      await CaseController.closeCase(user, c.id, closedAt);

      expect(prismaMock.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { closedAt, personalDataDueAt: new Date('2026-09-25T00:00:00.000Z') },
        })
      );
      jest.useRealTimers();
    });
  });

  describe('reopenCase', () => {
    it('clears closedAt/personalDataDueAt and deletes the existing closing-doc response', async () => {
      const user = buildUser({ role: Role.Admin });
      const c = caseFor(user, { closedAt: new Date('2026-01-01') });
      prismaMock.case.findUnique.mockResolvedValue(c);
      prismaMock.setting.findUnique.mockResolvedValue(
        buildSetting({ name: 'closing_doc', value: 'closing-form-id' })
      );
      const closingResponse = buildCaseFormResponse({
        caseId: c.id,
        caseFormId: 'closing-form-id',
      });
      prismaMock.caseFormResponse.findFirst.mockResolvedValue(closingResponse);
      const updated = buildCase({ closedAt: null });
      prismaMock.case.update.mockResolvedValue(updated);

      const result = await CaseController.reopenCase(user, c.id);

      expect(result).toBe(updated);
      expect(prismaMock.answer.deleteMany).toHaveBeenCalledWith({
        where: { caseFormResponseId: closingResponse.id },
      });
      expect(prismaMock.caseFormResponse.delete).toHaveBeenCalledWith({
        where: { id: closingResponse.id },
      });
      expect(prismaMock.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: c.id },
          data: { closedAt: null, personalDataDueAt: null },
        })
      );
    });

    it('throws ForbiddenError for a user not responsible for the case', async () => {
      const user = buildUser({ role: Role.User });
      const c = buildCase({ responsibleUsers: [{ id: 'someone-else' }] });
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(CaseController.reopenCase(user, c.id)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('purgeFamily', () => {
    it('purges the family and returns the updated case for a privileged user', async () => {
      const user = buildUser({ role: Role.Admin });
      const family = buildFamily();
      const c = buildCase({ family, familyId: family.id, responsibleUsers: [] });
      prismaMock.case.findUnique.mockResolvedValue(c);
      prismaMock.caseFormResponse.findMany.mockResolvedValue([]);
      prismaMock.family.delete.mockResolvedValue(family);
      const finalCase = buildCase({ familyId: null });
      prismaMock.case.findUniqueOrThrow.mockResolvedValueOnce(c).mockResolvedValue(finalCase);

      const result = await CaseController.purgeFamily(user, c.id);

      expect(prismaMock.family.delete).toHaveBeenCalledWith({ where: { id: family.id } });
      expect(result).toBe(finalCase);
    });

    it('throws ForbiddenError for a non-privileged user', async () => {
      const user = buildUser({ role: Role.User });
      const family = buildFamily();
      const c = buildCase({ family, familyId: family.id, responsibleUsers: [{ id: user.id }] });
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(CaseController.purgeFamily(user, c.id)).rejects.toThrow(ForbiddenError);
      expect(prismaMock.family.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the family was already purged', async () => {
      const user = buildUser({ role: Role.Admin });
      const c = buildCase({ family: null, familyId: null });
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(CaseController.purgeFamily(user, c.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getMyCases', () => {
    it("scope 'own' filters to the user's own cases", async () => {
      const user = buildUser({ role: Role.User });
      const cases = [caseFor(user)];
      prismaMock.case.findMany.mockResolvedValue(cases);

      const result = await CaseController.getMyCases(user, 'own');

      expect(result).toBe(cases);
      expect(prismaMock.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            responsibleUsers: { some: { id: user.id } },
          }),
        })
      );
    });

    it("scope 'org' works for an OrgCoordinator", async () => {
      const user = buildUser({ role: Role.OrgCoordinator, organisationId: 'org-1' });
      const cases = [buildCase({ organisationId: 'org-1', responsibleUsers: [] })];
      prismaMock.case.findMany.mockResolvedValue(cases);

      const result = await CaseController.getMyCases(user, 'org');

      expect(result).toBe(cases);
      expect(prismaMock.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organisationId: 'org-1' }) })
      );
    });

    it("scope 'org' is forbidden for a non-OrgCoordinator", async () => {
      const user = buildUser({ role: Role.User });

      await expect(CaseController.getMyCases(user, 'org')).rejects.toThrow(ForbiddenError);
      expect(prismaMock.case.findMany).not.toHaveBeenCalled();
    });

    it("scope 'subOrg' works for a SubOrgCoordinator", async () => {
      const user = buildUser({
        role: Role.SubOrgCoordinator,
        subOrganisations: [{ id: 'suborg-1' }],
      });
      const cases = [buildCase({ subOrganisationId: 'suborg-1', responsibleUsers: [] })];
      prismaMock.case.findMany.mockResolvedValue(cases);

      const result = await CaseController.getMyCases(user, 'subOrg');

      expect(result).toBe(cases);
      expect(prismaMock.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subOrganisationId: { in: ['suborg-1'] },
          }),
        })
      );
    });

    it("scope 'subOrg' is forbidden when the user has no suborganisations", async () => {
      const user = buildUser({ role: Role.SubOrgCoordinator, subOrganisations: [] });

      await expect(CaseController.getMyCases(user, 'subOrg')).rejects.toThrow(ForbiddenError);
      expect(prismaMock.case.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getCaseAttachments', () => {
    it('returns attachments for a visible case', async () => {
      const user = buildUser({ role: Role.Admin });
      const c = caseFor(user);
      prismaMock.case.findUnique.mockResolvedValue(c);
      const attachments = [buildCaseAttachment({ caseId: c.id })];
      prismaMock.caseAttachment.findMany.mockResolvedValue(attachments);

      const result = await CaseController.getCaseAttachments(user, c.id);

      expect(result).toBe(attachments);
    });

    it('throws NotFoundError when the case is missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(CaseController.getCaseAttachments(user, 'missing')).rejects.toThrow(
        NotFoundError
      );
    });

    it('throws ForbiddenError for Controller (attachments hold personal data)', async () => {
      const user = buildUser({ role: Role.Controller });
      const c = caseFor({ id: 'someone-else' });
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(CaseController.getCaseAttachments(user, c.id)).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('createCaseAttachment', () => {
    it('creates an attachment for a responsible user', async () => {
      const user = buildUser({ role: Role.User });
      const c = caseFor(user);
      prismaMock.case.findUnique.mockResolvedValue(c);
      const created = buildCaseAttachment({ caseId: c.id });
      prismaMock.caseAttachment.create.mockResolvedValue(created);
      const file = multerFile();

      const result = await CaseController.createCaseAttachment(user, c.id, file, 'a note');

      expect(result).toBe(created);
      expect(prismaMock.caseAttachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            case: { connect: { id: c.id } },
            filename: file.originalname,
            storageKey: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            note: 'a note',
            uploadedBy: { connect: { id: user.id } },
          }),
        })
      );
    });

    it('throws ForbiddenError for a user not responsible for the case', async () => {
      const user = buildUser({ role: Role.User });
      const c = caseFor({ id: 'someone-else' });
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(
        CaseController.createCaseAttachment(user, c.id, multerFile())
      ).rejects.toThrow(ForbiddenError);
      expect(prismaMock.caseAttachment.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError for OrgCoordinator (read-only access)', async () => {
      const user = buildUser({ role: Role.OrgCoordinator, organisationId: 'org-1' });
      const c = buildCase({ organisationId: 'org-1', responsibleUsers: [] });
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(
        CaseController.createCaseAttachment(user, c.id, multerFile())
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws BadRequestError when no file is uploaded', async () => {
      const user = buildUser({ role: Role.User });
      const c = caseFor(user);
      prismaMock.case.findUnique.mockResolvedValue(c);

      await expect(
        CaseController.createCaseAttachment(user, c.id, undefined)
      ).rejects.toThrow(BadRequestError);
      expect(prismaMock.caseAttachment.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the case is missing', async () => {
      const user = buildUser({ role: Role.User });
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(
        CaseController.createCaseAttachment(user, 'missing', multerFile())
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getCaseAttachmentFile', () => {
    it('streams the file for a visible case', async () => {
      const user = buildUser({ role: Role.Admin });
      const attachment = buildCaseAttachment();
      prismaMock.caseAttachment.findUnique.mockResolvedValue(attachment);
      const c = caseFor(user, { id: attachment.caseId });
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(c);
      const res = {} as any;

      await CaseController.getCaseAttachmentFile(user, attachment.id, res);

      expect(streamFile).toHaveBeenCalledWith(
        attachment.storageKey,
        'case-attachments',
        attachment.filename,
        attachment.mimeType,
        res
      );
    });

    it('throws NotFoundError when the attachment is missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.caseAttachment.findUnique.mockResolvedValue(null);

      await expect(
        CaseController.getCaseAttachmentFile(user, 'missing', {} as any)
      ).rejects.toThrow(NotFoundError);
      expect(streamFile).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when the case is not visible', async () => {
      const user = buildUser({ role: Role.Controller });
      const attachment = buildCaseAttachment();
      prismaMock.caseAttachment.findUnique.mockResolvedValue(attachment);
      const c = caseFor({ id: 'someone-else' }, { id: attachment.caseId });
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(c);

      await expect(
        CaseController.getCaseAttachmentFile(user, attachment.id, {} as any)
      ).rejects.toThrow(ForbiddenError);
      expect(streamFile).not.toHaveBeenCalled();
    });
  });

  describe('deleteCaseAttachment', () => {
    it('deletes the attachment and its stored file for the uploader', async () => {
      const user = buildUser({ role: Role.User });
      const attachment = buildCaseAttachment({ uploadedById: user.id });
      prismaMock.caseAttachment.findUnique.mockResolvedValue(attachment);
      const c = buildCase({ id: attachment.caseId });
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(c);
      prismaMock.caseAttachment.delete.mockResolvedValue(attachment);

      const result = await CaseController.deleteCaseAttachment(user, attachment.id);

      expect(result).toBe(attachment);
      expect(deleteStoredFile).toHaveBeenCalledWith(attachment.storageKey, 'case-attachments');
    });

    it('throws ForbiddenError for a user who did not upload the attachment', async () => {
      const user = buildUser({ role: Role.User });
      const attachment = buildCaseAttachment({ uploadedById: 'someone-else' });
      prismaMock.caseAttachment.findUnique.mockResolvedValue(attachment);
      const c = buildCase({ id: attachment.caseId });
      prismaMock.case.findUniqueOrThrow.mockResolvedValue(c);

      await expect(
        CaseController.deleteCaseAttachment(user, attachment.id)
      ).rejects.toThrow(ForbiddenError);
      expect(prismaMock.caseAttachment.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the attachment is missing', async () => {
      const user = buildUser({ role: Role.User });
      prismaMock.caseAttachment.findUnique.mockResolvedValue(null);

      await expect(CaseController.deleteCaseAttachment(user, 'missing')).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
