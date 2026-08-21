import { Router } from 'express';
import { UserController } from '../controller/UserController';

export const MeRouter = Router();

MeRouter.get('/', async (req, res) => {
  res.send(req.user!);
});

MeRouter.put('/', async (req, res) => {
  const { firstName, lastName } = req.body;

  const update = await UserController.update(req.user!, req.user!.id, {
    firstName,
    lastName,
  });

  res.send(update);
});
