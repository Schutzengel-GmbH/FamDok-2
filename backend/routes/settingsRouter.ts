import { Router } from 'express';
import { SettingsController } from '../controller/SettingsController';
import { route } from '../util/routerUtils';
import { SettingUpdateRequest } from '../../shared/api';
import { Settings } from '../../shared/types';

export const SettingsRouter = Router();

SettingsRouter.get(
  '/',
  route(({ user }) =>
    SettingsController.getSettings()
  )
);

SettingsRouter.put(
  '/:name',
  route({ body: SettingUpdateRequest }, ({ user, params, body }) =>
    SettingsController.updateSetting(
      user,
      params.name as keyof Settings,
      body.value
    )
  )
);
