import { Router } from 'express';
import { CaseFormController } from '../controller/CaseFormController';
import { handleError } from '../util/routerUtils';
import { Prisma } from '../../shared/generated/prisma/client';

const CaseFormRouter = Router();

CaseFormRouter.get('/', async (req, res) => {
  const where = req.query['where']
    ? (JSON.parse(req.query['where'] as string) as Prisma.CaseFormWhereInput)
    : undefined;

  try {
    const caseformDefinitions = await CaseFormController.getWhere(
      req.user!,
      where
    );
    res.send(caseformDefinitions);
  } catch (e) {
    handleError(e, res);
  }
});

CaseFormRouter.get('/i/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const caseformDefinition = await CaseFormController.get(req.user!, id);
    res.send(caseformDefinition);
  } catch (e) {
    handleError(e, res);
  }
});

CaseFormRouter.post('/', async (req, res) => {
  const caseformDefinitionInput = req.body as Prisma.CaseFormCreateInput;

  try {
    const caseformDefinition = await CaseFormController.create(
      req.user!,
      caseformDefinitionInput
    );
    res.send(caseformDefinition);
  } catch (e) {
    handleError(e, res);
  }
});

CaseFormRouter.put('/i/:id', async (req, res) => {
  const { id } = req.params;
  const updateInput = req.body as Prisma.CaseFormUpdateInput;

  try {
    const caseformDefinition = await CaseFormController.update(
      req.user!,
      id,
      updateInput
    );
    res.send(caseformDefinition);
  } catch (e) {
    handleError(e, res);
  }
});

CaseFormRouter.delete('/i/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const caseformDefinition = await CaseFormController.delete(req.user!, id);
    res.send(caseformDefinition);
  } catch (e) {
    handleError(e, res);
  }
});

export default CaseFormRouter;
