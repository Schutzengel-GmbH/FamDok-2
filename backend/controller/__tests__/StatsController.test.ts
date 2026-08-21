jest.mock('../../db', () => ({ prisma: require('../../testUtils/prismaMock').createPrismaMock() }));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import { buildCase, buildCaseForm, buildContactDocumentation, buildUser } from '../../testUtils/fixtures';
import { StatsController } from '../StatsController';
import { BadRequestError, ForbiddenError } from '../../util/authUtils';
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

    it('throws BadRequestError when the filter contains personal family data', async () => {
      const admin = buildUser({ role: Role.Admin });

      await expect(
        StatsController.getCases(admin, { family: { name: 'Smith' } } as any)
      ).rejects.toThrow(BadRequestError);
      expect(prismaMock.case.findMany).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when the filter uses aggregate operators', async () => {
      const admin = buildUser({ role: Role.Admin });

      await expect(
        StatsController.getCases(admin, { AND: [{ organisationId: 'org-1' }] } as any)
      ).rejects.toThrow(BadRequestError);
    });

    it('allows filtering by family city/plz', async () => {
      const admin = buildUser({ role: Role.Admin });
      prismaMock.case.findMany.mockResolvedValue([]);

      await expect(
        StatsController.getCases(admin, { family: { adress: { path: ['city'], equals: 'X' } } } as any)
      ).resolves.toEqual([]);
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

  describe('countGeneralFormResponses', () => {
    it('counts responses for a privileged user', async () => {
      const admin = buildUser({ role: Role.Admin });
      prismaMock.generalFormResponse.count.mockResolvedValue(2);

      const result = await StatsController.countGeneralFormResponses(admin, {});

      expect(result).toBe(2);
    });

    it('throws ForbiddenError for a plain user', async () => {
      const user = buildUser({ role: Role.User });

      await expect(StatsController.countGeneralFormResponses(user, {})).rejects.toThrow(
        ForbiddenError
      );
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

    it('throws a ZodError when the contactDocumentation filter includes createdBy', async () => {
      const admin = buildUser({ role: Role.Admin });

      await expect(
        StatsController.contactDocumentation(admin, {}, { createdBy: { id: 'user-1' } } as any)
      ).rejects.toThrow();
    });
  });

  describe('countContactDocumentation', () => {
    it('counts documentation for a privileged user', async () => {
      const admin = buildUser({ role: Role.Admin });
      prismaMock.contactDocumentation.count.mockResolvedValue(7);

      const result = await StatsController.countContactDocumentation(admin, {});

      expect(result).toBe(7);
    });

    it('throws ForbiddenError for a plain user', async () => {
      const user = buildUser({ role: Role.User });

      await expect(StatsController.countContactDocumentation(user, {})).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('countCaseFormResponses', () => {
    it('counts responses for a form without personal data', async () => {
      const admin = buildUser({ role: Role.Admin });
      const form = buildCaseForm({ containsPersonalData: false });
      prismaMock.caseForm.findUniqueOrThrow.mockResolvedValue(form);
      prismaMock.caseFormResponse.count.mockResolvedValue(3);

      const result = await StatsController.countCaseFormResponses(form.id, admin, {});

      expect(result).toBe(3);
    });

    it('throws ForbiddenError for a form containing personal data', async () => {
      const admin = buildUser({ role: Role.Admin });
      const form = buildCaseForm({ containsPersonalData: true });
      prismaMock.caseForm.findUniqueOrThrow.mockResolvedValue(form);

      await expect(StatsController.countCaseFormResponses(form.id, admin, {})).rejects.toThrow(
        ForbiddenError
      );
    });

    it('throws ForbiddenError for a plain user before touching prisma', async () => {
      const user = buildUser({ role: Role.User });

      await expect(StatsController.countCaseFormResponses('form-1', user, {})).rejects.toThrow(
        ForbiddenError
      );
      expect(prismaMock.caseForm.findUniqueOrThrow).not.toHaveBeenCalled();
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
