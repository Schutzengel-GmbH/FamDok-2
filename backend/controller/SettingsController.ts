import { ZodError } from 'zod';
import { Role } from '../../shared/generated/prisma/enums';
import { FullUser, Settings } from '../../shared/types';
import { prisma } from '../db';
import { BadRequestError, UnauthorizedError } from '../util/authUtils';
import { SettingsKeys } from '../../shared/zodTypes';

export class SettingsController {
  static getSettings() {
    return prisma.setting.findMany();
  }

  static updateSetting(user: FullUser, name: keyof Settings, value: string) {
    if (user.role !== Role.Admin) throw new UnauthorizedError();

    try {
      name = SettingsKeys.parse(name);
    } catch (e) {
      if (e instanceof ZodError)
        throw new BadRequestError('Failed to parse settings key');
      throw e;
    }

    const setting = prisma.setting.upsert({
      where: { name },
      update: { value },
      create: { name, value },
    });

    return setting;
  }
}
