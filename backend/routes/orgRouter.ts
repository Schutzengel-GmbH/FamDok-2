import { Router } from 'express';
import { handleError } from '../util/routerUtils';
import { OrgController } from '../controller/OrgController';
import { Prisma } from '../../shared/generated/prisma/client';

export const OrgRouter = Router();

OrgRouter.get('/', async (req, res) => {
  try {
    const orgs = await OrgController.getAllOrgs(req.user!);
    res.status(200).json(orgs);
  } catch (e) {
    handleError(e, res);
  }
});

OrgRouter.post('/', async (req, res) => {
  try {
    const data = req.body as Prisma.OrganisationCreateInput;

    const update = await OrgController.createOrg(req.user!, data);
    res.status(201).json(update);
  } catch (e) {
    handleError(e, res);
  }
});

OrgRouter.get('/i/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const org = await OrgController.getOrg(req.user!, id);
    res.status(200).json(org);
  } catch (e) {
    handleError(e, res);
  }
});

OrgRouter.delete('/i/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deletion = await OrgController.deleteOrg(req.user!, id);
    res.status(200).json(deletion);
  } catch (e) {
    handleError(e, res);
  }
});

OrgRouter.put('/i/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body as Prisma.OrganisationUpdateInput;

    const update = await OrgController.updateOrg(req.user!, id, data);
    res.status(200).json(update);
  } catch (e) {
    handleError(e, res);
  }
});
