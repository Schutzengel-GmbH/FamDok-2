jest.mock('../../db', () => ({ prisma: require('../../testUtils/prismaMock').createPrismaMock() }));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import { buildCaseForm, buildUser } from '../../testUtils/fixtures';
import { CaseFormController } from '../CaseFormController';
import { ForbiddenError } from '../../util/authUtils';
import { Role } from '../../../shared/generated/prisma/client';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

describe('CaseFormController', () => {
  describe('getAll', () => {
    it('returns all case forms visible to a privileged user', async () => {
      const admin = buildUser({ role: Role.Admin });
      const forms = [buildCaseForm()];
      prismaMock.caseForm.findMany.mockResolvedValue(forms);

      const result = await CaseFormController.getAll(admin);

      expect(result).toBe(forms);
      expect(prismaMock.caseForm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { AND: [] } })
      );
    });

    it('restricts a plain user to global and own-org forms', async () => {
      const user = buildUser({ role: Role.User, organisationId: 'org-1' });
      prismaMock.caseForm.findMany.mockResolvedValue([]);

      await CaseFormController.getAll(user);

      expect(prismaMock.caseForm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ OR: [{ organisationId: null }, { organisationId: 'org-1' }] }] },
        })
      );
    });
  });

  describe('getWhere', () => {
    it('combines the provided filter with the user\'s where restrictions', async () => {
      const user = buildUser({ role: Role.User, organisationId: 'org-1' });
      const forms = [buildCaseForm()];
      prismaMock.caseForm.findMany.mockResolvedValue(forms);

      const result = await CaseFormController.getWhere(user, { name: 'Intake' } as any);

      expect(result).toBe(forms);
      expect(prismaMock.caseForm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { name: 'Intake' },
              { OR: [{ organisationId: null }, { organisationId: 'org-1' }] },
            ],
          },
        })
      );
    });
  });

  describe('get', () => {
    it('returns the caseForm by id', async () => {
      const user = buildUser({ role: Role.Admin });
      const form = buildCaseForm();
      prismaMock.caseForm.findFirst.mockResolvedValue(form);

      const result = await CaseFormController.get(user, form.id);

      expect(result).toBe(form);
    });
  });

  describe('create', () => {
    it('creates a form for a privileged user', () => {
      const admin = buildUser({ role: Role.Admin });
      const created = buildCaseForm();
      prismaMock.caseForm.create.mockResolvedValue(created);

      const result = CaseFormController.create(admin, { name: 'New Form' } as any);

      expect(result).resolves.toBe(created);
    });

    it('throws ForbiddenError for a plain user', () => {
      const user = buildUser({ role: Role.User });

      expect(() => CaseFormController.create(user, { name: 'New Form' } as any)).toThrow(
        ForbiddenError
      );
      expect(prismaMock.caseForm.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a form for a privileged user', async () => {
      const admin = buildUser({ role: Role.OrgController });
      const existing = buildCaseForm({ organisationId: admin.organisationId });
      prismaMock.caseForm.findUnique.mockResolvedValue(existing);
      const updated = buildCaseForm();
      prismaMock.caseForm.update.mockResolvedValue(updated);

      const result = await CaseFormController.update(admin, existing.id, {
        name: 'Renamed',
      } as any);

      expect(result).toBe(updated);
    });

    it('throws ForbiddenError for a plain user', async () => {
      const user = buildUser({ role: Role.User });
      prismaMock.caseForm.findUnique.mockResolvedValue(buildCaseForm());

      await expect(
        CaseFormController.update(user, 'form-1', { name: 'Renamed' } as any)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('delete', () => {
    it('deletes a form for a privileged user', async () => {
      const admin = buildUser({ role: Role.Admin });
      const existing = buildCaseForm();
      prismaMock.caseForm.findUnique.mockResolvedValue(existing);
      const deleted = buildCaseForm();
      prismaMock.caseForm.delete.mockResolvedValue(deleted);

      const result = await CaseFormController.delete(admin, existing.id);

      expect(result).toBe(deleted);
    });

    it('throws ForbiddenError for a plain user', async () => {
      const user = buildUser({ role: Role.User });
      prismaMock.caseForm.findUnique.mockResolvedValue(buildCaseForm());

      await expect(CaseFormController.delete(user, 'form-1')).rejects.toThrow(ForbiddenError);
      expect(prismaMock.caseForm.delete).not.toHaveBeenCalled();
    });
  });
});
