import { Router } from 'express';
import { handleError, route } from '../util/routerUtils';
import { OrgRequest } from '../../shared/api';
import { OrgController } from '../controller/OrgController';

export const OrgRouter = Router();

OrgRouter.get(
  '/',
  route(({ user }) =>
    OrgController.getAllOrgs(user)
  )
);

OrgRouter.post(
  '/',
  route({ body: OrgRequest }, ({ user, body, res }) => {
    res.status(201);
    return OrgController.createOrg(user, body);
  })
);

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

OrgRouter.put(
  '/i/:id',
  route({ body: OrgRequest }, ({ user, params, body }) =>
    OrgController.updateOrg(user, params.id, body)
  )
);

OrgRouter.post(
  '/i/:id/sub',
  route({ body: OrgRequest }, ({ user, params, body, res }) => {
    res.status(201);
    return OrgController.createSubOrg(user, params.id, body);
  })
);

OrgRouter.put(
  '/sub/:id',
  route({ body: OrgRequest }, ({ user, params, body }) =>
    OrgController.updateSubOrg(user, params.id, body)
  )
);

OrgRouter.delete(
  '/sub/:id',
  route(({ user, params }) => OrgController.deleteSubOrg(user, params.id))
);
