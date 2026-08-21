jest.mock('../../db', () => ({ prisma: require('../../testUtils/prismaMock').createPrismaMock() }));

const mockAdminClient = {
  users: {
    update: jest.fn(),
    del: jest.fn(),
  },
};
jest.mock('../../kcAdminClient', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve(mockAdminClient)),
}));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import { buildUser, buildSubOrganisation } from '../../testUtils/fixtures';
import { UserController } from '../UserController';
import { ForbiddenError, NotFoundError } from '../../util/authUtils';
import { Role } from '../../../shared/generated/prisma/client';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

describe('UserController', () => {
  describe('getAll', () => {
    it('returns all users for Admin', async () => {
      const admin = buildUser({ role: Role.Admin });
      const users = [buildUser()];
      prismaMock.user.findMany.mockResolvedValue(users);

      const result = await UserController.getAll(admin);

      expect(result).toBe(users);
    });

    it('throws ForbiddenError for non-admins', async () => {
      const user = buildUser({ role: Role.Controller });

      await expect(UserController.getAll(user)).rejects.toThrow(ForbiddenError);
      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getOrgUsers', () => {
    it('returns users for the same org', async () => {
      const org = 'org-1';
      const user = buildUser({ role: Role.OrgController, organisationId: org });
      const users = [buildUser({ organisationId: org })];
      prismaMock.user.findMany.mockResolvedValue(users);

      const result = await UserController.getOrgUsers(user, org);

      expect(result).toBe(users);
    });

    it('throws ForbiddenError for a different org', async () => {
      const user = buildUser({ role: Role.OrgController, organisationId: 'org-1' });

      await expect(UserController.getOrgUsers(user, 'org-2')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getSubOrgUsers', () => {
    it('returns users when the requesting user can see the sub-org', async () => {
      const subOrg = buildSubOrganisation();
      const user = buildUser({ role: Role.OrgController, organisationId: subOrg.organisationId });
      prismaMock.subOrganisation.findUniqueOrThrow.mockResolvedValue(subOrg);
      const users = [buildUser()];
      prismaMock.user.findMany.mockResolvedValue(users);

      const result = await UserController.getSubOrgUsers(user, subOrg.id);

      expect(result).toBe(users);
    });

    it('throws ForbiddenError when sub-org belongs to a different org', async () => {
      const subOrg = buildSubOrganisation({ organisationId: 'other-org' });
      const user = buildUser({ role: Role.OrgController, organisationId: 'org-1' });
      prismaMock.subOrganisation.findUniqueOrThrow.mockResolvedValue(subOrg);

      await expect(UserController.getSubOrgUsers(user, subOrg.id)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getUser', () => {
    it('returns the user when accessible', async () => {
      const target = buildUser({ organisationId: 'org-1' });
      const reqUser = buildUser({ role: Role.OrgController, organisationId: 'org-1' });
      prismaMock.user.findUnique.mockResolvedValue(target);

      const result = await UserController.getUser(reqUser, target.id);

      expect(result).toBe(target);
    });

    it('throws NotFoundError when the user does not exist', async () => {
      const reqUser = buildUser({ role: Role.Admin });
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(UserController.getUser(reqUser, 'missing')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when requesting user cannot see the org', async () => {
      const target = buildUser({ organisationId: 'org-1' });
      const reqUser = buildUser({ role: Role.OrgController, organisationId: 'org-2' });
      prismaMock.user.findUnique.mockResolvedValue(target);

      await expect(UserController.getUser(reqUser, target.id)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getUserByKC', () => {
    it('returns the user found by kcId', async () => {
      const user = buildUser();
      prismaMock.user.findUnique.mockResolvedValue(user);

      const result = await UserController.getUserByKC(user.kcId);

      expect(result).toBe(user);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { kcId: user.kcId } })
      );
    });

    it('returns null when not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await UserController.getUserByKC('missing');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('updates the user without touching keycloak when email is unchanged', async () => {
      const existing = buildUser({ organisationId: 'org-1' });
      const reqUser = buildUser({ role: Role.Admin });
      prismaMock.user.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, firstName: 'New' };
      prismaMock.user.update.mockResolvedValue(updated);

      const result = await UserController.update(reqUser, existing.id, { firstName: 'New' });

      expect(result).toBe(updated);
      expect(mockAdminClient.users.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when a Controller tries to edit a user', async () => {
      const existing = buildUser({ organisationId: 'org-1' });
      const reqUser = buildUser({ role: Role.Controller });
      prismaMock.user.findUnique.mockResolvedValue(existing);

      await expect(
        UserController.update(reqUser, existing.id, { firstName: 'New' })
      ).rejects.toThrow(ForbiddenError);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('updates the user and syncs email to keycloak when email changes', async () => {
      const existing = buildUser({ organisationId: 'org-1' });
      const reqUser = buildUser({ role: Role.Admin });
      prismaMock.user.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, email: 'new@example.com' };
      prismaMock.user.update.mockResolvedValue(updated);

      const result = await UserController.update(reqUser, existing.id, {
        email: 'new@example.com',
      });

      expect(result).toBe(updated);
      expect(mockAdminClient.users.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: existing.id }),
        expect.objectContaining({ email: 'new@example.com' })
      );
    });

    it('throws NotFoundError when the user does not exist', async () => {
      const reqUser = buildUser({ role: Role.Admin });
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(UserController.update(reqUser, 'missing', {})).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the requester cannot edit the user', async () => {
      const existing = buildUser({ organisationId: 'org-1' });
      const reqUser = buildUser({ role: Role.User, organisationId: 'org-1' });
      prismaMock.user.findUnique.mockResolvedValue(existing);

      await expect(UserController.update(reqUser, existing.id, { firstName: 'New' })).rejects.toThrow(
        ForbiddenError
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('creates a new user', async () => {
      const created = buildUser();
      prismaMock.user.create.mockResolvedValue(created);

      const result = await UserController.register({ email: 'x@example.com' } as any);

      expect(result).toBe(created);
    });
  });

  describe('delete', () => {
    it('deletes the user in prisma and keycloak', async () => {
      const existing = buildUser();
      prismaMock.user.delete.mockResolvedValue(existing);

      const result = await UserController.delete(existing.id);

      expect(result).toBe(existing);
      expect(mockAdminClient.users.del).toHaveBeenCalledWith(
        expect.objectContaining({ id: existing.kcId })
      );
    });
  });
});
