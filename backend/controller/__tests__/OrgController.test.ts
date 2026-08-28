jest.mock('../../db', () => ({ prisma: require('../../testUtils/prismaMock').createPrismaMock() }));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import { buildOrganisation, buildSubOrganisation, buildUser } from '../../testUtils/fixtures';
import { OrgController } from '../OrgController';
import { ForbiddenError, NotFoundError } from '../../util/authUtils';
import { Role } from '../../../shared/generated/prisma/client';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

describe('OrgController', () => {
  describe('getAllOrgs', () => {
    it('returns all orgs for Admin', async () => {
      const admin = buildUser({ role: Role.Admin });
      const orgs = [buildOrganisation()];
      prismaMock.organisation.findMany.mockResolvedValue(orgs);

      const result = await OrgController.getAllOrgs(admin);

      expect(result).toBe(orgs);
    });

    it('throws ForbiddenError for a plain User', async () => {
      const user = buildUser({ role: Role.User });

      await expect(OrgController.getAllOrgs(user)).rejects.toThrow(ForbiddenError);
      expect(prismaMock.organisation.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getOrg', () => {
    it('returns the org when the user belongs to it', async () => {
      const org = buildOrganisation();
      const user = buildUser({ role: Role.OrgController, organisationId: org.id });
      prismaMock.organisation.findUnique.mockResolvedValue(org);

      const result = await OrgController.getOrg(user, org.id);

      expect(result).toBe(org);
    });

    it('throws NotFoundError when the org does not exist', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.organisation.findUnique.mockResolvedValue(null);

      await expect(OrgController.getOrg(user, 'missing')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the user belongs to a different org', async () => {
      const org = buildOrganisation();
      const user = buildUser({ role: Role.OrgController, organisationId: 'other-org' });
      prismaMock.organisation.findUnique.mockResolvedValue(org);

      await expect(OrgController.getOrg(user, org.id)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('createOrg', () => {
    it('creates an org when the user can edit orgs', async () => {
      const admin = buildUser({ role: Role.Admin });
      const created = buildOrganisation();
      prismaMock.organisation.create.mockResolvedValue(created);

      const result = await OrgController.createOrg(admin, { name: 'New Org' } as any);

      expect(result).toBe(created);
      expect(prismaMock.organisation.create).toHaveBeenCalled();
    });

    it('throws ForbiddenError for a non-privileged user', async () => {
      const user = buildUser({ role: Role.User });

      await expect(
        OrgController.createOrg(user, { name: 'New Org' } as any)
      ).rejects.toThrow(ForbiddenError);
      expect(prismaMock.organisation.create).not.toHaveBeenCalled();
    });
  });

  describe('updateOrg', () => {
    it('updates when the user can edit orgs', async () => {
      const admin = buildUser({ role: Role.Controller });
      const updated = buildOrganisation();
      prismaMock.organisation.update.mockResolvedValue(updated);

      const result = await OrgController.updateOrg(admin, updated.id, { name: 'Renamed' } as any);

      expect(result).toBe(updated);
    });

    it('throws ForbiddenError for OrgController role', async () => {
      const user = buildUser({ role: Role.OrgController });

      await expect(
        OrgController.updateOrg(user, 'org-1', { name: 'Renamed' } as any)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('deleteOrg', () => {
    it('deletes when authorized', async () => {
      const admin = buildUser({ role: Role.Admin });
      const deleted = buildOrganisation();
      prismaMock.organisation.delete.mockResolvedValue(deleted);

      const result = await OrgController.deleteOrg(admin, deleted.id);

      expect(result).toBe(deleted);
    });

    it('throws ForbiddenError when unauthorized', async () => {
      const user = buildUser({ role: Role.User });

      await expect(OrgController.deleteOrg(user, 'org-1')).rejects.toThrow(ForbiddenError);
      expect(prismaMock.organisation.delete).not.toHaveBeenCalled();
    });
  });

  describe('getAllSubOrgs', () => {
    it('returns subOrganisations for accessible orgs', async () => {
      const subOrgs = [buildSubOrganisation()];
      const org = buildOrganisation({ subOrganisations: subOrgs });
      const user = buildUser({ role: Role.OrgController, organisationId: org.id });
      prismaMock.organisation.findUnique.mockResolvedValue(org);

      const result = await OrgController.getAllSubOrgs(user, org.id);

      expect(result).toBe(subOrgs);
    });

    it('throws NotFoundError when org missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.organisation.findUnique.mockResolvedValue(null);

      await expect(OrgController.getAllSubOrgs(user, 'missing')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when user cannot access the org', async () => {
      const org = buildOrganisation();
      const user = buildUser({ role: Role.OrgController, organisationId: 'other-org' });
      prismaMock.organisation.findUnique.mockResolvedValue(org);

      await expect(OrgController.getAllSubOrgs(user, org.id)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getSubOrg', () => {
    it('returns the subOrg for a user in the same org', async () => {
      const subOrg = buildSubOrganisation();
      const user = buildUser({ role: Role.User, organisationId: subOrg.organisationId });
      prismaMock.subOrganisation.findUnique.mockResolvedValue(subOrg);

      const result = await OrgController.getSubOrg(user, subOrg.id);

      expect(result).toBe(subOrg);
    });

    it('throws NotFoundError when subOrg missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.subOrganisation.findUnique.mockResolvedValue(null);

      await expect(OrgController.getSubOrg(user, 'missing')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when user belongs to a different org', async () => {
      const subOrg = buildSubOrganisation();
      const user = buildUser({ role: Role.User, organisationId: 'other-org' });
      prismaMock.subOrganisation.findUnique.mockResolvedValue(subOrg);

      await expect(OrgController.getSubOrg(user, subOrg.id)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('createSubOrg / updateSubOrg / deleteSubOrg', () => {
    it('createSubOrg succeeds for privileged users', async () => {
      const admin = buildUser({ role: Role.Admin });
      const created = buildSubOrganisation();
      prismaMock.subOrganisation.create.mockResolvedValue(created);

      const result = await OrgController.createSubOrg(admin, {
        name: 'Sub',
        organisation: { connect: { id: created.organisationId } },
      } as any);

      expect(result).toBe(created);
    });

    it('createSubOrg throws for unprivileged users', async () => {
      const user = buildUser({ role: Role.User });

      await expect(
        OrgController.createSubOrg(user, {
          name: 'Sub',
          organisation: { connect: { id: 'org-1' } },
        } as any)
      ).rejects.toThrow(ForbiddenError);
    });

    it('updateSubOrg succeeds for privileged users', async () => {
      const admin = buildUser({ role: Role.Controller });
      const updated = buildSubOrganisation();
      prismaMock.subOrganisation.update.mockResolvedValue(updated);

      const result = await OrgController.updateSubOrg(admin, updated.id, { name: 'Renamed' } as any);

      expect(result).toBe(updated);
    });

    it('updateSubOrg throws for unprivileged users', async () => {
      const user = buildUser({ role: Role.OrgController });

      await expect(
        OrgController.updateSubOrg(user, 'sub-1', { name: 'Renamed' } as any)
      ).rejects.toThrow(ForbiddenError);
    });

    it('deleteSubOrg succeeds for privileged users', async () => {
      const admin = buildUser({ role: Role.Admin });
      const deleted = buildSubOrganisation();
      prismaMock.subOrganisation.delete.mockResolvedValue(deleted);

      const result = await OrgController.deleteSubOrg(admin, deleted.id);

      expect(result).toBe(deleted);
    });

    it('deleteSubOrg throws for unprivileged users', async () => {
      const user = buildUser({ role: Role.User });

      await expect(OrgController.deleteSubOrg(user, 'sub-1')).rejects.toThrow(ForbiddenError);
    });
  });
});
