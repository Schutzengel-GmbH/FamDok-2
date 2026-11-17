import { Router } from 'express';
import { UserController } from '../controller/UserController';
import { route } from '../util/routerUtils';
import { MeUpdateRequest } from '../../shared/api';

export const MeRouter = Router();

MeRouter.get('/', async (req, res) => {
  res.send(req.user!);
});

MeRouter.put(
  '/',
  route({ body: MeUpdateRequest }, ({ user, body }) =>
    UserController.update(user, user.id, body)
  )
);
