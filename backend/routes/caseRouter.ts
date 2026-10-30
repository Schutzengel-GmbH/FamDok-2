import { NextFunction, Request, Response, Router } from 'express';
import { CaseController } from '../controller/CaseController';
import { handleError, route } from '../util/routerUtils';
import {
  CaseAttachmentRequest,
  CaseCloseRequest,
  CaseCreateRequest,
  CaseListQuery,
  ContactDocumentationCreateRequest,
  ContactDocumentationListQuery,
  ContactDocumentationUpdateRequest,
  HandoverRequest,
  LatestQuery,
  MyCasesQuery,
  ZielCreateRequest,
  ZielUpdateRequest,
} from '../../shared/api';
import { caseAttachmentUpload, handleUpload } from '../middleware/upload';
import { canUploadCaseAttachment } from '../controller/authFns/CaseAttachmentAuthFns';
import { ForbiddenError, NotFoundError } from '../util/authUtils';
import { prisma } from '../db';

const CaseRouter = Router();

// Runs before multer so an unauthorized upload attempt never gets written to disk.
async function requireCanUploadAttachment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const c = await prisma.case.findUnique({
      where: { id: req.params['id'] },
      include: { responsibleUsers: true },
    });
    if (!c) throw new NotFoundError();
    if (!canUploadCaseAttachment(req.user!, c))
      throw new ForbiddenError("User can't attach files to this case");
    next();
  } catch (e) {
    handleError(e, res);
  }
}

CaseRouter.get(
  '/',
  route({ query: CaseListQuery }, ({ user, query }) =>
    CaseController.getAll(user, query.where)
  )
);

CaseRouter.get(
  '/my',
  route({ query: MyCasesQuery }, ({ user, query }) =>
    CaseController.getMyCases(user, query)
  )
);

CaseRouter.get(
  '/i/:id',
  route(({ user, params }) =>
    CaseController.get(user, params.id)
  )
);

CaseRouter.post(
  '/',
  route({ body: CaseCreateRequest }, ({ user, body }) =>
    CaseController.create(user, body)
  )
);


CaseRouter.delete(
  '/i/:id',
  route(({ user, params }) =>
    CaseController.delete(user, params.id)
  )
);

CaseRouter.post(
  '/i/:id/ziel',
  route({ body: ZielCreateRequest }, ({ user, params, body }) =>
    CaseController.addZiel(user, params.id, body)
  )
);

CaseRouter.put(
  '/i/:id/ziel/:ziel',
  route({ body: ZielUpdateRequest }, ({ user, params, body }) =>
    CaseController.updateZiel(user, params.ziel, body)
  )
);

CaseRouter.delete(
  '/i/:id/ziel/:ziel',
  route(({ user, params }) =>
    CaseController.deleteZiel(user, params.ziel)
  )
);

CaseRouter.get(
  '/i/:id/documentation',
  route({ query: ContactDocumentationListQuery }, ({ user, params, query }) =>
    CaseController.getContactDocumentationForCase(user, params.id, query.where)
  )
);

CaseRouter.get(
  '/i/:id/documentation/latest',
  route({ query: LatestQuery }, ({ user, params, query }) =>
    CaseController.getLatestContactDocumentation(user, params.id, query.n)
  )
);

CaseRouter.get(
  '/i/:id/documentation/i/:docId',
  route(({ user, params }) =>
    CaseController.getContactDocumentation(user, params.docId)
  )
);

CaseRouter.get('/i/:id/documentation/i/:docId/download', async (req, res) => {
  const { id, docId } = req.params;
  try {
    const doc = await CaseController.getContactDocumentationPDF(
      req.user!,
      docId
    );

    res.contentType('application/pdf');
    res.send(doc);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.post(
  '/i/:id/documentation',
  route({ body: ContactDocumentationCreateRequest }, ({ user, params, body }) =>
    CaseController.createContactDocumentation(user, params.id, body)
  )
);

CaseRouter.put(
  '/i/:id/documentation/i/:docId',
  route({ body: ContactDocumentationUpdateRequest }, ({ user, params, body }) =>
    CaseController.updateContactDocumentation(user, params.docId, body)
  )
);

CaseRouter.delete(
  '/i/:id/documentation/i/:docId',
  route(({ user, params }) =>
    CaseController.deleteContactDocumentation(user, params.docId)
  )
);

CaseRouter.get(
  '/documentation/all',
  route({ query: ContactDocumentationListQuery }, ({ user, query }) =>
    CaseController.getContactDocumentations(user, query.where)
  )
);

CaseRouter.get(
  '/documentation/my',
  route({ query: ContactDocumentationListQuery }, ({ user, query }) =>
    CaseController.getMyContactDocumentations(user, query.where)
  )
);

CaseRouter.get('/i/:id/export/stammdaten', async (req, res) => {
  const { id } = req.params;
  try {
    const { filename, buffer } = await CaseController.getStammdatenPDF(
      req.user!,
      id
    );
    res.attachment(filename);
    res.contentType('application/pdf');
    res.send(buffer);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.get('/i/:id/export', async (req, res) => {
  const { id } = req.params;
  try {
    const { filename, archive } = await CaseController.getCaseExport(
      req.user!,
      id
    );
    // Headers are already sent once streaming starts, so a failure mid-archive can only abort
    // the connection - the client then sees an incomplete download instead of a corrupt ZIP.
    archive.on('error', (err) => {
      console.error(err);
      res.destroy(err);
    });
    res.attachment(filename);
    res.contentType('application/zip');
    archive.pipe(res);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.get(
  '/i/:id/attachment',
  route(({ user, params }) =>
    CaseController.getCaseAttachments(user, params.id)
  )
);

CaseRouter.get('/i/:id/attachment/i/:attId/download', async (req, res) => {
  const { attId } = req.params;
  try {
    await CaseController.getCaseAttachmentFile(req.user!, attId, res);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.post(
  '/i/:id/attachment',
  requireCanUploadAttachment,
  handleUpload(caseAttachmentUpload.single('file')),
  route({ body: CaseAttachmentRequest }, ({ user, params, file, body }) =>
    CaseController.createCaseAttachment(user, params.id, file, body.note)
  ));

CaseRouter.delete(
  '/i/:id/attachment/i/:attId',
  route(({ user, params }) =>
    CaseController.deleteCaseAttachment(user, params.attId)
  )
);

CaseRouter.get(
  '/handover/:caseId',
  route({ query: LatestQuery }, ({ user, params, query }) =>
    CaseController.getHandovers(user, params.caseId, query.n)
  )
);

CaseRouter.post(
  '/handover',
  route({ body: HandoverRequest }, ({ user, body }) =>
    CaseController.handover(user, body)
  )
);

CaseRouter.post(
  '/close/:caseId',
  route({ body: CaseCloseRequest }, ({ user, params, body }) =>
    CaseController.closeCase(user, params.caseId, body.date)
  )
);

CaseRouter.post(
  '/reopen/:caseId',
  route(({ user, params }) =>
    CaseController.reopenCase(user, params.id)
  )
);

CaseRouter.post(
  '/i/:id/purge',
  route(({ user, params }) =>
    CaseController.purgeFamily(user, params.id)
  )
);

export default CaseRouter;
