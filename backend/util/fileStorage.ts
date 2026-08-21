import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { UPLOAD_DIR } from '../config';
import { NotFoundError } from './authUtils';

export type StorageKind = 'documents' | 'case-attachments';

export function storageDirFor(kind: StorageKind): string {
  return path.join(UPLOAD_DIR, kind);
}

export function resolveStoragePath(
  storageKey: string,
  kind: StorageKind
): string {
  return path.join(storageDirFor(kind), storageKey);
}

export function deleteStoredFile(storageKey: string, kind: StorageKind): void {
  const filePath = resolveStoragePath(storageKey, kind);
  fs.rm(filePath, { force: true }, (err) => {
    if (err) console.error(`Failed to delete stored file ${filePath}:`, err);
  });
}

export function streamFile(
  storageKey: string,
  kind: StorageKind,
  filename: string,
  mimeType: string,
  res: Response
): void {
  const filePath = resolveStoragePath(storageKey, kind);
  if (!fs.existsSync(filePath)) throw new NotFoundError('File not found');

  res.contentType(mimeType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(filename)}"`
  );
  res.sendFile(filePath);
}
