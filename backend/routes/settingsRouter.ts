import { Router } from 'express';
import { SettingsController } from '../controller/SettingsController';
import { handleError } from '../util/routerUtils';
import { Settings } from '../../shared/types';

export const SettingsRouter = Router();

SettingsRouter.get('/', async (req, res) => {
  const settings = await SettingsController.getSettings();
  res.send(settings);
});

SettingsRouter.put('/:name', async (req, res) => {
  const { name } = req.params;

  try {
    const setting = await SettingsController.updateSetting(
      req.user!,
      name as keyof Settings,
      req.body.value
    );
    res.send(setting);
  } catch (e) {
    handleError(e, res);
  }
});
