import { Router } from 'express';
import { GeneralFormController } from '../controller/GeneralFormController';
import { Prisma } from '../../shared/generated/prisma/client';
import { handleError } from '../util/routerUtils';

const GeneralFormRouter = Router();

GeneralFormRouter.get('/definitions', async (req, res) => {
  const where = req.query['where']
    ? (JSON.parse(req.query['where'] as string) as Prisma.GeneralFormWhereInput)
    : undefined;

  try {
    const definitions = await GeneralFormController.getDefinitions(
      req.user!,
      where
    );
    res.status(200).json(definitions);
  } catch (e) {
    handleError(e, res);
  }
});

GeneralFormRouter.get('/definitions/i/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const definition = await GeneralFormController.getDefinition(
      req.user!,
      id
    );
    res.status(200).json(definition);
  } catch (e) {
    handleError(e, res);
  }
});

GeneralFormRouter.post('/definitions', async (req, res) => {
  const data = req.body as Prisma.GeneralFormCreateInput;

  try {
    const definition = await GeneralFormController.createDefinition(
      req.user!,
      data
    );
    res.status(201).json(definition);
  } catch (e) {
    handleError(e, res);
  }
});

GeneralFormRouter.put('/definitions/i/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body as Prisma.GeneralFormUpdateInput;
  try {
    const definition = await GeneralFormController.updateDefinition(
      req.user!,
      id,
      data
    );
    res.status(201).json(definition);
  } catch (e) {
    handleError(e, res);
  }
});

GeneralFormRouter.delete('/definitions/i/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const definition = await GeneralFormController.deleteDefinition(
      req.user!,
      id
    );
    res.status(200).json(definition);
  } catch (e) {
    handleError(e, res);
  }
});

GeneralFormRouter.get('/responses', async (req, res) => {
  const where = req.query['where']
    ? JSON.parse(req.query['where'] as string)
    : undefined;

  try {
    const responses = await GeneralFormController.getResponses(
      req.user!,
      where
    );
    res.status(200).json(responses);
  } catch (e) {
    handleError(e, res);
  }
});

GeneralFormRouter.get('/responses/i/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const response = await GeneralFormController.getResponse(req.user!, id);
    res.status(200).json(response);
  } catch (e) {
    handleError(e, res);
  }
});

GeneralFormRouter.post('/responses', async (req, res) => {
  const data = req.body as Prisma.GeneralFormResponseCreateInput;
  try {
    const response = await GeneralFormController.createResponse(
      req.user!,
      data
    );
    res.status(201).json(response);
  } catch (e) {
    handleError(e, res);
  }
});
GeneralFormRouter.put('/responses/i/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body as Prisma.GeneralFormResponseUpdateInput;
  try {
    const response = await GeneralFormController.updateResponse(
      req.user!,
      id,
      data
    );
    res.status(201).json(response);
  } catch (e) {
    handleError(e, res);
  }
});

GeneralFormRouter.delete('/responses/i/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const response = await GeneralFormController.deleteResponse(req.user!, id);
    res.status(200).json(response);
  } catch (e) {
    handleError(e, res);
  }
});

export default GeneralFormRouter;
