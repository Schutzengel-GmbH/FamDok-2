import fs from 'fs';
import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { MAX_UPLOAD_SIZE_MB } from '../config';
import { storageDirFor, StorageKind } from '../util/fileStorage';
import { BadRequestError } from '../util/authUtils';
import { handleError } from '../util/routerUtils';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
    return;
  }
  cb(null, true);
};

function storageFor(kind: StorageKind) {
  const dir = storageDirFor(kind);
  fs.mkdirSync(dir, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) =>
      cb(null, `${randomUUID()}${path.extname(file.originalname)}`),
  });
}

const limits = { fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024 };

export const documentUpload = multer({
  storage: storageFor('documents'),
  fileFilter,
  limits,
});

export const caseAttachmentUpload = multer({
  storage: storageFor('case-attachments'),
  fileFilter,
  limits,
});

/**
 * Wraps a multer middleware (e.g. `documentUpload.single('file')`) so file-too-large / disallowed
 * file type errors are reported via `handleError` as clean JSON, instead of falling through to
 * Express's default HTML error page.
 */
export function handleUpload(uploadMiddleware: RequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      const message = err instanceof Error ? err.message : 'Upload failed';
      handleError(new BadRequestError(message), res);
    });
  };
}
