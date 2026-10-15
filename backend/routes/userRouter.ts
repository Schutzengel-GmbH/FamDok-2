import { Router } from 'express';
import { UserController } from '../controller/UserController';
import { handleError } from '../util/routerUtils';
import { Prisma } from '../../shared/generated/prisma/client';

const UserRouter = Router();

UserRouter.get('/', async (req, res) => {
  const where = req.query['where']
    ? (JSON.parse(req.query['where'] as string) as Prisma.UserWhereInput)
    : {};

  try {
    const users = await UserController.getAll(req.user!, where);
    res.status(200).send(users);
  } catch (e) {
    handleError(e, res);
  }
});

UserRouter.get('/org/:id', async (req, res) => {
  const { id } = req.params;

  const where = req.query['where']
    ? (JSON.parse(req.query['where'] as string) as Prisma.UserWhereInput)
    : {};

  try {
    const users = await UserController.getOrgUsers(req.user!, id, where);
    res.status(200).send(users);
  } catch (e) {
    handleError(e, res);
  }
});

UserRouter.post('/', async (req, res) => {
  try {
    const user = await UserController.create(req.user!, req.body);
    res.status(201).send(user);
  } catch (e) {
    handleError(e, res);
  }
});

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

UserRouter.put('/i/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await UserController.update(req.user!, id, req.body);
    res.send(user);
  } catch (e) {
    handleError(e, res);
  }
});

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

UserRouter.post('/i/:id/temp-password', async (req, res) => {
  try {
    const result = await UserController.issueTempPassword(
      req.user!,
      req.params.id
    );
    res.send(result);
  } catch (e) {
    handleError(e, res);
  }
});

UserRouter.put('/i/:id/enabled', async (req, res) => {
  try {
    const user = await UserController.setEnabled(
      req.user!,
      req.params.id,
      req.body
    );
    res.send(user);
  } catch (e) {
    handleError(e, res);
  }
});

export default UserRouter;
