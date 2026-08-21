import { NextFunction, Request, Response, Router } from 'express';
import { DocumentController } from '../controller/DocumentController';
import { handleError } from '../util/routerUtils';
import { Prisma } from '../../shared/generated/prisma/client';
import { documentUpload, handleUpload } from '../middleware/upload';
import { canManageDocuments } from '../controller/authFns/DocumentAuthFns';
import { ForbiddenError } from '../util/authUtils';

const DocumentRouter = Router();

function requireManageDocuments(req: Request, res: Response, next: NextFunction) {
  if (!canManageDocuments(req.user!)) {
    handleError(new ForbiddenError('Admins only'), res);
    return;
  }
  next();
}

DocumentRouter.get('/', async (req, res) => {
  const where = req.query['where']
    ? (JSON.parse(req.query['where'] as string) as Prisma.DocumentWhereInput)
    : undefined;

  try {
    const documents = await DocumentController.getAll(req.user!, where);
    res.send(documents);
  } catch (e) {
    handleError(e, res);
  }
});

DocumentRouter.get('/tags', async (req, res) => {
  try {
    const tags = await DocumentController.getTags(req.user!);
    res.send(tags);
  } catch (e) {
    handleError(e, res);
  }
});

DocumentRouter.post('/tags', requireManageDocuments, async (req, res) => {
  try {
    const tag = await DocumentController.createTag(req.user!, req.body.name);
    res.send(tag);
  } catch (e) {
    handleError(e, res);
  }
});

DocumentRouter.put('/tags/i/:id', requireManageDocuments, async (req, res) => {
  const { id } = req.params;
  try {
    const tag = await DocumentController.renameTag(req.user!, id, req.body.name);
    res.send(tag);
  } catch (e) {
    handleError(e, res);
  }
});

DocumentRouter.delete(
  '/tags/i/:id',
  requireManageDocuments,
  async (req, res) => {
    const { id } = req.params;
    try {
      const tag = await DocumentController.deleteTag(req.user!, id);
      res.send(tag);
    } catch (e) {
      handleError(e, res);
    }
  }
);

DocumentRouter.get('/i/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await DocumentController.get(req.user!, id);
    res.send(doc);
  } catch (e) {
    handleError(e, res);
  }
});

DocumentRouter.get('/i/:id/download', async (req, res) => {
  const { id } = req.params;
  try {
    await DocumentController.downloadFile(req.user!, id, res);
  } catch (e) {
    handleError(e, res);
  }
});

DocumentRouter.post(
  '/',
  requireManageDocuments,
  handleUpload(documentUpload.single('file')),
  async (req, res) => {
    try {
      const doc = await DocumentController.create(req.user!, req.file, req.body);
      res.send(doc);
    } catch (e) {
      handleError(e, res);
    }
  }
);

DocumentRouter.put('/i/:id', requireManageDocuments, async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await DocumentController.update(req.user!, id, req.body);
    res.send(doc);
  } catch (e) {
    handleError(e, res);
  }
});

DocumentRouter.delete('/i/:id', requireManageDocuments, async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await DocumentController.delete(req.user!, id);
    res.send(doc);
  } catch (e) {
    handleError(e, res);
  }
});

export default DocumentRouter;
