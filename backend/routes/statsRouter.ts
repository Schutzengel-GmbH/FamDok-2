import { Router } from 'express';
import { StatsController } from '../controller/StatsController';
import { handleError } from '../util/routerUtils';
import {
  CaseFormResponseWhereInput,
  CaseWhereInput,
  ContactDocumentationWhereInput,
  GeneralFormResponseWhereInput,
} from '../../shared/generated/prisma/models';

export const StatsRouter = Router();

StatsRouter.get('/case', async (req, res) => {
  try {
    const where = req.query['where']
      ? (JSON.parse(req.query['where'] as string) as CaseWhereInput)
      : {};
    const activeBetween = req.query['activeBetween']
      ? (JSON.parse(req.query['activeBetween'] as string) as {
          start: Date;
          end: Date;
        })
      : undefined;

    const cases = await StatsController.getCases(
      req.user!,
      where,
      activeBetween
    );
    res.status(200).json(cases);
  } catch (e) {
    handleError(e, res);
  }
});

StatsRouter.get('/case/count', async (req, res) => {
  try {
    const where = req.query['where']
      ? (JSON.parse(req.query['where'] as string) as CaseWhereInput)
      : {};
    const activeBetween = req.query['activeBetween']
      ? (JSON.parse(req.query['activeBetween'] as string) as {
          start: Date;
          end: Date;
        })
      : undefined;

    const cases = await StatsController.countCases(
      req.user!,
      where,
      activeBetween
    );
    res.status(200).json(cases);
  } catch (e) {
    handleError(e, res);
  }
});

StatsRouter.get('/contactDocumentation', async (req, res) => {
  try {
    const caseWhere = req.query['caseFilter']
      ? JSON.parse(req.query['caseFilter'] as string)
      : undefined;
    const docWhere = req.query['docFilter']
      ? JSON.parse(req.query['docFilter'] as string)
      : undefined;

    const docs = await StatsController.contactDocumentation(
      req.user!,
      caseWhere,
      docWhere
    );
    res.status(200).json(docs);
  } catch (e) {
    handleError(e, res);
  }
});

StatsRouter.get('/contactDocumentation/count', async (req, res) => {
  try {
    const where = req.query['where']
      ? (JSON.parse(
          req.query['where'] as string
        ) as ContactDocumentationWhereInput)
      : {};

    const cases = await StatsController.countContactDocumentation(
      req.user!,
      where
    );
    res.status(200).json(cases);
  } catch (e) {
    handleError(e, res);
  }
});

StatsRouter.get('/caseFormResponses/count', async (req, res) => {
  try {
    const id = req.query['id'] as string;
    const where = req.query['where']
      ? (JSON.parse(req.query['where'] as string) as CaseFormResponseWhereInput)
      : {};

    const cases = await StatsController.countCaseFormResponses(
      id,
      req.user!,
      where
    );
    res.status(200).json(cases);
  } catch (e) {
    handleError(e, res);
  }
});

StatsRouter.get('/generalFormResponses/count', async (req, res) => {
  try {
    const where = req.query['where']
      ? (JSON.parse(
          req.query['where'] as string
        ) as GeneralFormResponseWhereInput)
      : {};

    const cases = await StatsController.countGeneralFormResponses(
      req.user!,
      where
    );
    res.status(200).json(cases);
  } catch (e) {
    handleError(e, res);
  }
});

StatsRouter.get('/cities', async (req, res) => {
  try {
    const cities = await StatsController.getCities(req.user!);
    res.status(200).json(cities);
  } catch (e) {
    handleError(e, res);
  }
});
