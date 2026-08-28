import { createPrismaMock } from '../../testUtils/prismaMock';
import { buildSetting, buildUser } from '../../testUtils/fixtures';

jest.mock('../../db', () => ({ prisma: require('../../testUtils/prismaMock').createPrismaMock() }));

import { prisma } from '../../db';
import { SettingsController } from '../SettingsController';
import { BadRequestError, UnauthorizedError } from '../../util/authUtils';
import { Role } from '../../../shared/generated/prisma/client';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

describe('SettingsController', () => {
  describe('getSettings', () => {
    it('returns all settings from prisma', async () => {
      const settings = [buildSetting({ name: 'closing_doc', value: 'abc' })];
      prismaMock.setting.findMany.mockResolvedValue(settings);

      const result = await SettingsController.getSettings();

      expect(prismaMock.setting.findMany).toHaveBeenCalledWith();
      expect(result).toBe(settings);
    });
  });

  describe('updateSetting', () => {
    it('upserts the setting for an Admin', async () => {
      const admin = buildUser({ role: Role.Admin });
      const updated = buildSetting({ name: 'closing_doc', value: 'form-1' });
      prismaMock.setting.upsert.mockResolvedValue(updated);

      const result = await SettingsController.updateSetting(admin, 'closing_doc', 'form-1');

      expect(result).toBe(updated);
      expect(prismaMock.setting.upsert).toHaveBeenCalledWith({
        where: { name: 'closing_doc' },
        update: { value: 'form-1' },
        create: { name: 'closing_doc', value: 'form-1' },
      });
    });

    it('throws UnauthorizedError for a non-Admin', async () => {
      const user = buildUser({ role: Role.Controller });

      expect(() => SettingsController.updateSetting(user, 'closing_doc', 'form-1')).toThrow(
        UnauthorizedError
      );
      expect(prismaMock.setting.upsert).not.toHaveBeenCalled();
    });

    it('throws BadRequestError for an unknown settings key', async () => {
      const admin = buildUser({ role: Role.Admin });

      expect(() =>
        SettingsController.updateSetting(admin, 'not_a_real_key' as any, 'form-1')
      ).toThrow(BadRequestError);
      expect(prismaMock.setting.upsert).not.toHaveBeenCalled();
    });
  });
});
