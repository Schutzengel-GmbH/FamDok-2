jest.mock('../../db', () => ({ prisma: require('../../testUtils/prismaMock').createPrismaMock() }));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import { buildCase, buildCaseForm, buildContactDocumentation, buildUser } from '../../testUtils/fixtures';
import { StatsController } from '../StatsController';
import { ForbiddenError } from '../../util/authUtils';
import { Role } from '../../../shared/generated/prisma/client';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

describe('StatsController', () => {
  describe('getCases', () => {
    it('returns anonymised cases for a privileged user with a valid filter', async () => {
      const admin = buildUser({ role: Role.Admin });
      const cases = [buildCase()];
      prismaMock.case.findMany.mockResolvedValue(cases);

      const result = await StatsController.getCases(admin, { organisationId: 'org-1' } as any);

      expect(result).toBe(cases);
    });

    it('throws ForbiddenError for a plain user', async () => {
      const user = buildUser({ role: Role.User });

      await expect(StatsController.getCases(user)).rejects.toThrow(ForbiddenError);
      expect(prismaMock.case.findMany).not.toHaveBeenCalled();
    });
  });

  describe('countCases', () => {
    it('counts cases for a privileged user', async () => {
      const admin = buildUser({ role: Role.Controller });
      prismaMock.case.count.mockResolvedValue(5);

      const result = await StatsController.countCases(admin, {});

      expect(result).toBe(5);
    });

    it('throws ForbiddenError for a plain user', async () => {
      const user = buildUser({ role: Role.User });

      await expect(StatsController.countCases(user, {})).rejects.toThrow(ForbiddenError);
    });
  });

  describe('contactDocumentation', () => {
    it('returns anonymised contact documentation entries', async () => {
      const admin = buildUser({ role: Role.Admin });
      const doc = buildContactDocumentation({ zusammenfassung: 'secret', dokumentation: 'secret', userId: 'user-1' });
      prismaMock.contactDocumentation.findMany.mockResolvedValue([doc]);

      const result = await StatsController.contactDocumentation(admin, {}, {});

      expect(result).toEqual([
        {
          id: doc.id,
          date: doc.date,
          caseId: doc.caseId,
          artDerBetreuung: doc.artDerBetreuung,
          beratungsThemenAllgemein: doc.beratungsThemenAllgemein,
          beratungsThemenEltern: doc.beratungsThemenEltern,
          beratungsThemenKinder: doc.beratungsThemenKinder,
          duration: doc.duration,
        },
      ]);
      expect(result[0]).not.toHaveProperty('zusammenfassung');
      expect(result[0]).not.toHaveProperty('dokumentation');
      expect(result[0]).not.toHaveProperty('userId');
    });

    it('throws ForbiddenError for a plain user', async () => {
      const user = buildUser({ role: Role.User });

      await expect(StatsController.contactDocumentation(user, {}, {})).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('getCities', () => {
    it('returns the list of cities', async () => {
      const admin = buildUser({ role: Role.Admin });
      prismaMock.$queryRaw.mockResolvedValue([{ city: 'Berlin' }, { city: 'Munich' }]);

      const result = await StatsController.getCities(admin);

      expect(result).toEqual(['Berlin', 'Munich']);
    });

    it('throws ForbiddenError for a plain user', async () => {
      const user = buildUser({ role: Role.User });

      await expect(StatsController.getCities(user)).rejects.toThrow(ForbiddenError);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
