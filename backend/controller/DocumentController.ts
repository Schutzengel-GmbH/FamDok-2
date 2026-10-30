import { prisma } from '../db';
import { BadRequestError, ForbiddenError, NotFoundError } from '../util/authUtils';
import { deleteStoredFile, streamFile } from '../util/fileStorage';
import { canManageDocuments, canSeeDocuments } from './authFns/DocumentAuthFns';
import { FullUser } from '../../shared/types';
import { DOCUMENT_DEFAULT_INCLUDE } from '../../shared/consts';
import { DocumentMeta } from '../../shared/api';
import { Response } from 'express';

export class DocumentController {
  static async getAll(user: FullUser) {
    if (!canSeeDocuments(user)) throw new ForbiddenError();

    return prisma.document.findMany({
      include: DOCUMENT_DEFAULT_INCLUDE,
      omit: { storageKey: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async get(user: FullUser, id: string) {
    if (!canSeeDocuments(user)) throw new ForbiddenError();

    const doc = await prisma.document.findUnique({
      where: { id },
      include: DOCUMENT_DEFAULT_INCLUDE,
      omit: { storageKey: true },
    });
    if (!doc) throw new NotFoundError();
    return doc;
  }

  static async getTags(user: FullUser) {
    if (!canSeeDocuments(user)) throw new ForbiddenError();
    return prisma.tag.findMany({ orderBy: { name: 'asc' } });
  }

  static async downloadFile(user: FullUser, id: string, res: Response) {
    if (!canSeeDocuments(user)) throw new ForbiddenError();

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundError();

    streamFile(doc.storageKey, 'documents', doc.filename, doc.mimeType, res);
  }

  static async create(
    user: FullUser,
    file: Express.Multer.File | undefined,
    meta: DocumentMeta
  ) {
    if (!canManageDocuments(user)) throw new ForbiddenError();
    if (!file) throw new BadRequestError('No file uploaded');

    return prisma.document.create({
      data: {
        title: meta.title,
        description: meta.description,
        filename: file.originalname,
        storageKey: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: { connect: { id: user.id } },
        tags: { connect: meta.tagIds.map((id) => ({ id })) },
      },
      include: DOCUMENT_DEFAULT_INCLUDE,
      omit: { storageKey: true },
    });
  }

  static async update(user: FullUser, id: string, meta: DocumentMeta) {
    if (!canManageDocuments(user)) throw new ForbiddenError();

    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError();

    return prisma.document.update({
      where: { id },
      data: {
        title: meta.title,
        description: meta.description,
        tags: { set: meta.tagIds.map((id) => ({ id })) },
      },
      include: DOCUMENT_DEFAULT_INCLUDE,
      omit: { storageKey: true },
    });
  }

  static async delete(user: FullUser, id: string) {
    if (!canManageDocuments(user)) throw new ForbiddenError();

    const doc = await prisma.document.delete({ where: { id } });
    deleteStoredFile(doc.storageKey, 'documents');
    return doc;
  }

  static async createTag(user: FullUser, name: string) {
    if (!canManageDocuments(user)) throw new ForbiddenError();
    if (!name?.trim()) throw new BadRequestError('Tag name is required');

    return prisma.tag.create({ data: { name: name.trim() } });
  }

  static async renameTag(user: FullUser, id: string, name: string) {
    if (!canManageDocuments(user)) throw new ForbiddenError();
    if (!name?.trim()) throw new BadRequestError('Tag name is required');

    return prisma.tag.update({ where: { id }, data: { name: name.trim() } });
  }

  static async deleteTag(user: FullUser, id: string) {
    if (!canManageDocuments(user)) throw new ForbiddenError();
    return prisma.tag.delete({ where: { id } });
  }
}
