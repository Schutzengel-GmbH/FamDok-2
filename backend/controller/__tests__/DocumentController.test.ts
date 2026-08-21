jest.mock('../../db', () => ({ prisma: require('../../testUtils/prismaMock').createPrismaMock() }));
jest.mock('../../util/fileStorage', () => ({
  streamFile: jest.fn(),
  deleteStoredFile: jest.fn(),
}));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import { buildDocument, buildTag, buildUser } from '../../testUtils/fixtures';
import { DocumentController } from '../DocumentController';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../util/authUtils';
import { streamFile, deleteStoredFile } from '../../util/fileStorage';
import { Role } from '../../../shared/generated/prisma/client';
import { Response } from 'express';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

function multerFile(overrides: Record<string, any> = {}): Express.Multer.File {
  return {
    originalname: 'test.pdf',
    filename: 'stored-key.pdf',
    mimetype: 'application/pdf',
    size: 1234,
    ...overrides,
  } as Express.Multer.File;
}

describe('DocumentController', () => {
  describe('getAll', () => {
    it('returns documents for any role', async () => {
      const user = buildUser({ role: Role.Controller });
      const docs = [buildDocument()];
      prismaMock.document.findMany.mockResolvedValue(docs);

      const result = await DocumentController.getAll(user);

      expect(result).toBe(docs);
    });

    it('applies a valid where filter', async () => {
      const user = buildUser();
      prismaMock.document.findMany.mockResolvedValue([]);

      await DocumentController.getAll(user, { title: 'Consent' } as any);

      expect(prismaMock.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { title: 'Consent' } })
      );
    });

    it('throws a validation error for an unknown where field', async () => {
      const user = buildUser();

      await expect(
        DocumentController.getAll(user, { notARealField: true } as any)
      ).rejects.toThrow();
      expect(prismaMock.document.findMany).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('returns the document by id', async () => {
      const user = buildUser();
      const doc = buildDocument();
      prismaMock.document.findUnique.mockResolvedValue(doc);

      const result = await DocumentController.get(user, doc.id);

      expect(result).toBe(doc);
    });

    it('throws NotFoundError when missing', async () => {
      const user = buildUser();
      prismaMock.document.findUnique.mockResolvedValue(null);

      await expect(DocumentController.get(user, 'missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getTags', () => {
    it('returns all tags', async () => {
      const user = buildUser();
      const tags = [buildTag()];
      prismaMock.tag.findMany.mockResolvedValue(tags);

      const result = await DocumentController.getTags(user);

      expect(result).toBe(tags);
    });
  });

  describe('downloadFile', () => {
    it('streams the file for a visible document', async () => {
      const user = buildUser();
      const doc = buildDocument();
      prismaMock.document.findUnique.mockResolvedValue(doc);
      const res = {} as Response;

      await DocumentController.downloadFile(user, doc.id, res);

      expect(streamFile).toHaveBeenCalledWith(
        doc.storageKey,
        'documents',
        doc.filename,
        doc.mimeType,
        res
      );
    });

    it('throws NotFoundError when the document does not exist', async () => {
      const user = buildUser();
      prismaMock.document.findUnique.mockResolvedValue(null);

      await expect(
        DocumentController.downloadFile(user, 'missing', {} as Response)
      ).rejects.toThrow(NotFoundError);
      expect(streamFile).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates a document for Admin', async () => {
      const admin = buildUser({ role: Role.Admin });
      const created = buildDocument();
      prismaMock.document.create.mockResolvedValue(created);
      const file = multerFile();

      const result = await DocumentController.create(admin, file, {
        title: 'Consent form',
        tagIds: JSON.stringify(['tag-1']),
      });

      expect(result).toBe(created);
      expect(prismaMock.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Consent form',
            filename: file.originalname,
            storageKey: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            uploadedBy: { connect: { id: admin.id } },
            tags: { connect: [{ id: 'tag-1' }] },
          }),
        })
      );
    });

    it('throws ForbiddenError for a non-Admin', async () => {
      const user = buildUser({ role: Role.Controller });

      await expect(
        DocumentController.create(user, multerFile(), { title: 'x' })
      ).rejects.toThrow(ForbiddenError);
      expect(prismaMock.document.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when no file is uploaded', async () => {
      const admin = buildUser({ role: Role.Admin });

      await expect(
        DocumentController.create(admin, undefined, { title: 'x' })
      ).rejects.toThrow(BadRequestError);
      expect(prismaMock.document.create).not.toHaveBeenCalled();
    });

    it('throws a validation error when the title is missing', async () => {
      const admin = buildUser({ role: Role.Admin });

      await expect(
        DocumentController.create(admin, multerFile(), { title: '' })
      ).rejects.toThrow();
      expect(prismaMock.document.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a document for Admin', async () => {
      const admin = buildUser({ role: Role.Admin });
      const existing = buildDocument();
      prismaMock.document.findUnique.mockResolvedValue(existing);
      const updated = buildDocument({ title: 'Renamed' });
      prismaMock.document.update.mockResolvedValue(updated);

      const result = await DocumentController.update(admin, existing.id, {
        title: 'Renamed',
        tagIds: JSON.stringify(['tag-2']),
      });

      expect(result).toBe(updated);
      expect(prismaMock.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: existing.id },
          data: expect.objectContaining({
            title: 'Renamed',
            tags: { set: [{ id: 'tag-2' }] },
          }),
        })
      );
    });

    it('throws ForbiddenError for a non-Admin', async () => {
      const user = buildUser({ role: Role.Controller });

      await expect(
        DocumentController.update(user, 'doc-1', { title: 'Renamed' })
      ).rejects.toThrow(ForbiddenError);
      expect(prismaMock.document.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when missing', async () => {
      const admin = buildUser({ role: Role.Admin });
      prismaMock.document.findUnique.mockResolvedValue(null);

      await expect(
        DocumentController.update(admin, 'missing', { title: 'Renamed' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('deletes the document and its stored file for Admin', async () => {
      const admin = buildUser({ role: Role.Admin });
      const deleted = buildDocument();
      prismaMock.document.delete.mockResolvedValue(deleted);

      const result = await DocumentController.delete(admin, deleted.id);

      expect(result).toBe(deleted);
      expect(deleteStoredFile).toHaveBeenCalledWith(deleted.storageKey, 'documents');
    });

    it('throws ForbiddenError for a non-Admin', async () => {
      const user = buildUser({ role: Role.Controller });

      await expect(DocumentController.delete(user, 'doc-1')).rejects.toThrow(ForbiddenError);
      expect(prismaMock.document.delete).not.toHaveBeenCalled();
    });
  });

  describe('createTag', () => {
    it('creates a tag for Admin', async () => {
      const admin = buildUser({ role: Role.Admin });
      const created = buildTag({ name: 'Formulare' });
      prismaMock.tag.create.mockResolvedValue(created);

      const result = await DocumentController.createTag(admin, ' Formulare ');

      expect(result).toBe(created);
      expect(prismaMock.tag.create).toHaveBeenCalledWith({ data: { name: 'Formulare' } });
    });

    it('throws ForbiddenError for a non-Admin', async () => {
      const user = buildUser({ role: Role.Controller });

      await expect(DocumentController.createTag(user, 'Formulare')).rejects.toThrow(
        ForbiddenError
      );
      expect(prismaMock.tag.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestError for a blank name', async () => {
      const admin = buildUser({ role: Role.Admin });

      await expect(DocumentController.createTag(admin, '   ')).rejects.toThrow(BadRequestError);
      expect(prismaMock.tag.create).not.toHaveBeenCalled();
    });
  });

  describe('renameTag', () => {
    it('renames a tag for Admin', async () => {
      const admin = buildUser({ role: Role.Admin });
      const renamed = buildTag({ name: 'Neuer Name' });
      prismaMock.tag.update.mockResolvedValue(renamed);

      const result = await DocumentController.renameTag(admin, renamed.id, ' Neuer Name ');

      expect(result).toBe(renamed);
      expect(prismaMock.tag.update).toHaveBeenCalledWith({
        where: { id: renamed.id },
        data: { name: 'Neuer Name' },
      });
    });

    it('throws ForbiddenError for a non-Admin', async () => {
      const user = buildUser({ role: Role.Controller });

      await expect(DocumentController.renameTag(user, 'tag-1', 'Name')).rejects.toThrow(
        ForbiddenError
      );
      expect(prismaMock.tag.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestError for a blank name', async () => {
      const admin = buildUser({ role: Role.Admin });

      await expect(DocumentController.renameTag(admin, 'tag-1', '')).rejects.toThrow(
        BadRequestError
      );
      expect(prismaMock.tag.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteTag', () => {
    it('deletes a tag for Admin', async () => {
      const admin = buildUser({ role: Role.Admin });
      const deleted = buildTag();
      prismaMock.tag.delete.mockResolvedValue(deleted);

      const result = await DocumentController.deleteTag(admin, deleted.id);

      expect(result).toBe(deleted);
    });

    it('throws ForbiddenError for a non-Admin', async () => {
      const user = buildUser({ role: Role.Controller });

      await expect(DocumentController.deleteTag(user, 'tag-1')).rejects.toThrow(ForbiddenError);
      expect(prismaMock.tag.delete).not.toHaveBeenCalled();
    });
  });
});
