import { NextFunction, Request, Response, Router } from 'express';
import { DocumentController } from '../controller/DocumentController';
import { handleError, route } from '../util/routerUtils';
import { DocumentMeta, TagRequest } from '../../shared/api';
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

DocumentRouter.get(
  '/',
  route(({ user }) => DocumentController.getAll(user))
);

DocumentRouter.get(
  '/tags',
  route(({ user }) =>
    DocumentController.getTags(user)
  )
);

DocumentRouter.post(
  '/tags',
  requireManageDocuments,
  route({ body: TagRequest }, ({ user, body }) =>
    DocumentController.createTag(user, body.name)
  )
);

DocumentRouter.put(
  '/tags/i/:id',
  requireManageDocuments,
  route({ body: TagRequest }, ({ user, params, body }) =>
    DocumentController.renameTag(user, params.id, body.name)
  )
);

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

DocumentRouter.get(
  '/i/:id',
  route(({ user, params }) =>
    DocumentController.get(user, params.id)
  )
);

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
  route({ body: DocumentMeta }, ({ user, file, body }) =>
    DocumentController.create(user, file, body)
  ));

DocumentRouter.put(
  '/i/:id',
  requireManageDocuments,
  route({ body: DocumentMeta }, ({ user, params, body }) =>
    DocumentController.update(user, params.id, body)
  )
);

DocumentRouter.delete(
  '/i/:id',
  requireManageDocuments,
  route(({ user, params }) =>
    DocumentController.delete(user, params.id)
  )
);

export default DocumentRouter;
