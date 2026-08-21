import { NextFunction, Request, Response, Router } from 'express';
import { CaseController } from '../controller/CaseController';
import { handleError } from '../util/routerUtils';
import { Handover, Prisma } from '../../shared/generated/prisma/client';
import { caseAttachmentUpload, handleUpload } from '../middleware/upload';
import { canUploadCaseAttachment } from '../controller/authFns/CaseAttachmentAuthFns';
import { ForbiddenError, NotFoundError } from '../util/authUtils';
import { prisma } from '../db';
import { CASE_DEFAULT_INCLUDE } from '../../shared/consts';

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
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!c) throw new NotFoundError();
    if (!canUploadCaseAttachment(req.user!, c))
      throw new ForbiddenError("User can't attach files to this case");
    next();
  } catch (e) {
    handleError(e, res);
  }
}

CaseRouter.get('/', async (req, res) => {
  const where = req.query['where']
    ? (JSON.parse(req.query['where'] as string) as Prisma.CaseWhereInput)
    : {};

  try {
    const cases = await CaseController.getAll(req.user!, where);
    res.status(200).send(cases);
  } catch (e) {
    handleError(e, res);
  }
});

const MY_CASES_SCOPES = ['own', 'org', 'subOrg'] as const;

CaseRouter.get('/my', async (req, res) => {
  const where = req.query['where']
    ? (JSON.parse(req.query['where'] as string) as Prisma.CaseWhereInput)
    : {};

  const include = req.query['include']
    ? (JSON.parse(req.query['include'] as string) as Prisma.CaseInclude)
    : {};

  const rawScope = (req.query['scope'] as string) ?? 'own';
  if (!MY_CASES_SCOPES.includes(rawScope as (typeof MY_CASES_SCOPES)[number])) {
    res.status(400).json({ message: 'Bad Request', error: 'Invalid scope' });
    return;
  }
  const scope = rawScope as (typeof MY_CASES_SCOPES)[number];

  try {
    const cases = await CaseController.getMyCases(
      req.user!,
      scope,
      where,
      include
    );
    res.status(200).send(cases);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.get('/i/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const Case = await CaseController.get(req.user!, id);
    res.send(Case);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.post('/', async (req, res) => {
  const data = req.body as Prisma.CaseCreateInput;
  try {
    const Case = await CaseController.create(req.user!, {
      ...data,
      createdBy: { connect: { id: req.user!.id } },
      responsibleUsers: { connect: { id: req.user!.id } },
    });
    res.send(Case);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.put('/i/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const update = await CaseController.updateCase(req.user!, id, req.body);
    res.send(update);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.delete('/i/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await CaseController.delete(req.user!, id);
    res.send(result);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.post('/i/:id/ziel', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await CaseController.addZiel(req.user!, id, req.body);
    res.json(result);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.put('/i/:id/ziel/:ziel', async (req, res) => {
  const { ziel } = req.params;

  try {
    const result = await CaseController.updateZiel(req.user!, ziel, req.body);
    res.json(result);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.delete('/i/:id/ziel/:ziel', async (req, res) => {
  const { ziel } = req.params;

  try {
    const result = await CaseController.deleteZiel(req.user!, ziel);
    res.json(result);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.get('/i/:id/documentation', async (req, res) => {
  const { id } = req.params;

  const where = req.query['where']
    ? (JSON.parse(
        req.query['where'] as string
      ) as Prisma.ContactDocumentationWhereInput)
    : {};

  try {
    const doc = await CaseController.getContactDocumentationForCase(
      req.user!,
      id,
      where
    );
    res.send(doc);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.get('/i/:id/documentation/latest', async (req, res) => {
  const { id } = req.params;
  const { n } = req.query;
  const number = parseInt(n as string) || undefined;

  try {
    const doc = await CaseController.getLatestContactDocumentation(
      req.user!,
      id,
      number
    );
    res.send(doc);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.get('/i/:id/documentation/i/:docId', async (req, res) => {
  const { id, docId } = req.params;
  try {
    const doc = await CaseController.getContactDocumentation(req.user!, docId);
    res.send(doc);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.get('/i/:id/documentation/i/:docId/download', async (req, res) => {
  const { id, docId } = req.params;
  try {
    const doc = await CaseController.getContactDocumentationPDF(
      req.user!,
      docId
    ).then((b) => {
      res.contentType('application/pdf');
      res.send(b);
    });
    res.send(doc);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.post('/i/:id/documentation', async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await CaseController.createContactDocumentation(
      req.user!,
      id,
      req.body
    );
    res.send(doc);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.put('/i/:id/documentation/i/:docId', async (req, res) => {
  const { docId } = req.params;
  try {
    const doc = await CaseController.updateContactDocumentation(
      req.user!,
      docId,
      req.body
    );
    res.send(doc);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.delete('/i/:id/documentation/i/:docId', async (req, res) => {
  const { docId } = req.params;
  try {
    const doc = await CaseController.deleteContactDocumentation(
      req.user!,
      docId
    );
    res.send(doc);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.get('/documentation/all', async (req, res) => {
  const where = req.query['where']
    ? (JSON.parse(
        req.query['where'] as string
      ) as Prisma.ContactDocumentationWhereInput)
    : {};

  try {
    const doc = await CaseController.getContactDocumentations(req.user!, where);
    res.send(doc);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.get('/documentation/my', async (req, res) => {
  const where = req.query['where']
    ? (JSON.parse(
        req.query['where'] as string
      ) as Prisma.ContactDocumentationWhereInput)
    : {};

  try {
    const doc = await CaseController.getMyContactDocumentations(
      req.user!,
      where
    );
    res.send(doc);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.get('/i/:id/attachment', async (req, res) => {
  const { id } = req.params;
  try {
    const attachments = await CaseController.getCaseAttachments(req.user!, id);
    res.send(attachments);
  } catch (e) {
    handleError(e, res);
  }
});

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
  async (req, res) => {
    const { id } = req.params;
    try {
      const attachment = await CaseController.createCaseAttachment(
        req.user!,
        id,
        req.file,
        req.body?.note
      );
      res.send(attachment);
    } catch (e) {
      handleError(e, res);
    }
  }
);

CaseRouter.delete('/i/:id/attachment/i/:attId', async (req, res) => {
  const { attId } = req.params;
  try {
    const attachment = await CaseController.deleteCaseAttachment(
      req.user!,
      attId
    );
    res.send(attachment);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.get('/handover/:caseId', async (req, res) => {
  const { caseId } = req.params;
  const n = req.query['n'] ? parseInt(req.query['n'] as string) : undefined;

  try {
    const handovers = await CaseController.getHandovers(req.user!, caseId, n);
    res.send(handovers);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.post('/handover', async (req, res) => {
  const handover = req.body as Handover;

  try {
    const update = await CaseController.handover(req.user!, handover);
    res.send(update);
  } catch (e) {
    handleError(e, res);
  }
});

CaseRouter.post('/close/:caseId', async (req, res) => {
  const { caseId: id } = req.params;
  const date = req.body.date as Date;

  try {
    const result = await CaseController.closeCase(req.user!, id, date);
    res.send(result);
  } catch (e) {
    handleError(e, res);
  }
});

export default CaseRouter;
