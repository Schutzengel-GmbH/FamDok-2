import { Router } from 'express';
import { handleError } from '../util/routerUtils';
import { WarningsController } from '../controller/WarningsController';

export const WarningsRouter = Router();

WarningsRouter.get('/', async (req, res) => {
  try {
    const warnings = await WarningsController.getWarnings(req.user!.id);
    res.send(warnings);
  } catch (err) {
    handleError(err, res);
  }
});
