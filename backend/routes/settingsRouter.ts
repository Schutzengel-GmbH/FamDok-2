import { Router } from 'express';
import { SettingsController } from '../controller/SettingsController';

export const SettingsRouter = Router();

SettingsRouter.get('/', async (req, res) => {
  const settings = await SettingsController.getSettings();
  res.send(settings);
});
