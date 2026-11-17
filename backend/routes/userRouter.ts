import { Router } from 'express';
import { UserController } from '../controller/UserController';
import { handleError, route } from '../util/routerUtils';
import {
  OrgUsersQuery,
  UserCreateRequest,
  UserEnabledRequest,
  UserUpdateRequest,
} from '../../shared/api';

const UserRouter = Router();

UserRouter.get(
  '/',
  route(({ user }) => UserController.getAll(user))
);

UserRouter.get(
  '/org/:id',
  route({ query: OrgUsersQuery }, ({ user, params, query }) =>
    UserController.getOrgUsers(user, params.id, query.where)
  )
);

UserRouter.post(
  '/',
  route({ body: UserCreateRequest }, ({ user, body }) =>
    UserController.create(user, body)
  )
);

UserRouter.get('/i/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await UserController.getUser(req.user!, id);
    if (!user) res.status(404).send();
    else res.status(200).send(user);
  } catch (e) {
    handleError(e, res);
  }
});

UserRouter.put(
  '/i/:id',
  route({ body: UserUpdateRequest }, ({ user, params, body }) =>
    UserController.update(user, params.id, body)
  )
);

UserRouter.delete('/i/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserController.delete(req.user!, id);
    res.send(user);
  } catch (e) {
    handleError(e, res);
  }
});

UserRouter.post('/i/:id/invite', async (req, res) => {
  try {
    await UserController.resendInvite(req.user!, req.params.id);
    res.status(204).send();
  } catch (e) {
    handleError(e, res);
  }
});

UserRouter.post(
  '/i/:id/temp-password',
  route(({ user, params }) =>
    UserController.issueTempPassword(user, params.id)
  )
);

UserRouter.put(
  '/i/:id/enabled',
  route({ body: UserEnabledRequest }, ({ user, params, body }) =>
    UserController.setEnabled(user, params.id, body)
  )
);

export default UserRouter;
