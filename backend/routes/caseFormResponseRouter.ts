import { Router } from 'express';
import { CaseFormResponseController } from '../controller/CaseFormResponseController';
import { handleError } from '../util/routerUtils';
import { Prisma } from '../../shared/generated/prisma/client';

const CaseFormResponseRouter = Router();

CaseFormResponseRouter.get('/', async (req, res) => {
  const where = req.query['where']
    ? (JSON.parse(
        req.query['where'] as string
      ) as Prisma.CaseFormResponseWhereInput)
    : undefined;

  try {
    const caseformResponses = await CaseFormResponseController.getWhere(
      req.user!,
      where
    );
    res.send(caseformResponses);
  } catch (e) {
    handleError(e, res);
  }
});

CaseFormResponseRouter.get('/i/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const caseformResponse = await CaseFormResponseController.get(
      req.user!,
      id
    );
    res.send(caseformResponse);
  } catch (e) {
    handleError(e, res);
  }
});

CaseFormResponseRouter.post('/', async (req, res) => {
  const caseformResponseInput = req.body as Prisma.CaseFormResponseCreateInput;
  caseformResponseInput.createdBy = { connect: { id: req.user!.id } };

  try {
    const caseformResponse = await CaseFormResponseController.create(
      req.user!,
      caseformResponseInput
    );
    res.send(caseformResponse);
  } catch (e) {
    handleError(e, res);
  }
});

CaseFormResponseRouter.put('/i/:id', async (req, res) => {
  const { id } = req.params;
  const updateInput = req.body as Prisma.CaseFormResponseUpdateInput;

  try {
    const caseformResponse = await CaseFormResponseController.update(
      req.user!,
      id,
      updateInput
    );
    res.send(caseformResponse);
  } catch (e) {
    handleError(e, res);
  }
});

CaseFormResponseRouter.delete('/i/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const caseformResponse = await CaseFormResponseController.delete(
      req.user!,
      id
    );
    res.send(caseformResponse);
  } catch (e) {
    handleError(e, res);
  }
});

export default CaseFormResponseRouter;
