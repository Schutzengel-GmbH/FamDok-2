jest.mock('../../db', () => ({
  prisma: require('../../testUtils/prismaMock').createPrismaMock(),
}));

const mockAdminClient = {
  users: {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    del: jest.fn(),
    executeActionsEmail: jest.fn(),
    resetPassword: jest.fn(),
  },
};
jest.mock('../../kcAdminClient', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve(mockAdminClient)),
}));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import {
  buildUser,
  buildSubOrganisation,
  buildOrganisation,
} from '../../testUtils/fixtures';
import { generateTempPassword, UserController } from '../UserController';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../util/authUtils';
import { ZodError } from 'zod';
import { Role } from '../../../shared/generated/prisma/client';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

describe('UserController', () => {
  beforeEach(() => {
    Object.values(mockAdminClient.users).forEach((fn) => fn.mockReset());
    Object.values(prismaMock.user).forEach((fn: any) => fn.mockReset?.());
    mockAdminClient.users.find.mockResolvedValue([]);
  });

  describe('getAll', () => {
    it('returns all users for Admin', async () => {
      const admin = buildUser({ role: Role.Admin });
      const users = [buildUser()];
      prismaMock.user.findMany.mockResolvedValue(users);

      const result = await UserController.getAll(admin);

      expect(result).toEqual(users);
    });

    it('merges the keycloak account status for admins', async () => {
      const admin = buildUser({ role: Role.Admin });
      const user = buildUser();
      prismaMock.user.findMany.mockResolvedValue([user]);
      mockAdminClient.users.find.mockResolvedValue([
        {
          id: user.kcId,
          enabled: false,
          emailVerified: true,
          requiredActions: ['UPDATE_PASSWORD'],
        },
      ]);

      const [result] = await UserController.getAll(admin);

      expect(result.kcStatus).toEqual({
        enabled: false,
        emailVerified: true,
        pendingActions: ['UPDATE_PASSWORD'],
      });
    });

    it('still returns users when keycloak is unreachable', async () => {
      const admin = buildUser({ role: Role.Admin });
      const users = [buildUser()];
      prismaMock.user.findMany.mockResolvedValue(users);
      mockAdminClient.users.find.mockRejectedValue(new Error('down'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await UserController.getAll(admin);

      expect(result).toEqual(users);
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

      expect(result).toEqual(users);
      expect(mockAdminClient.users.find).toHaveBeenCalled();
    });

    it('throws ForbiddenError for a different org', async () => {
      const user = buildUser({
        role: Role.OrgController,
        organisationId: 'org-1',
      });

      await expect(UserController.getOrgUsers(user, 'org-2')).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('getSubOrgUsers', () => {
    it('returns users when the requesting user can see the sub-org', async () => {
      const subOrg = buildSubOrganisation();
      const user = buildUser({
        role: Role.OrgController,
        organisationId: subOrg.organisationId,
      });
      prismaMock.subOrganisation.findUniqueOrThrow.mockResolvedValue(subOrg);
      const users = [buildUser()];
      prismaMock.user.findMany.mockResolvedValue(users);

      const result = await UserController.getSubOrgUsers(user, subOrg.id);

      expect(result).toBe(users);
    });

    it('throws ForbiddenError when sub-org belongs to a different org', async () => {
      const subOrg = buildSubOrganisation({ organisationId: 'other-org' });
      const user = buildUser({
        role: Role.OrgController,
        organisationId: 'org-1',
      });
      prismaMock.subOrganisation.findUniqueOrThrow.mockResolvedValue(subOrg);

      await expect(
        UserController.getSubOrgUsers(user, subOrg.id)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getUser', () => {
    it('returns the user but not KC user when accessible', async () => {
      const target = buildUser({ organisationId: 'org-1' });
      const reqUser = buildUser({
        role: Role.User,
        organisationId: 'org-1',
      });
      prismaMock.user.findUnique.mockResolvedValue(target);

      const result = await UserController.getUser(reqUser, target.id);

      expect(result).toBe(target);
      expect(mockAdminClient.users.findOne).not.toHaveBeenCalled();
    });

    it('returns the user and KC user data when editable', async () => {
      const target = buildUser({ organisationId: 'org-1' });
      const reqUser = buildUser({
        role: Role.OrgController,
        organisationId: 'org-1',
      });
      prismaMock.user.findUnique.mockResolvedValue(target);

      const result = await UserController.getUser(reqUser, target.id);

      expect(result).toBe(target);
      expect(mockAdminClient.users.findOne).toHaveBeenCalled();
    });

    it('throws NotFoundError when the user does not exist', async () => {
      const reqUser = buildUser({ role: Role.Admin });
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(UserController.getUser(reqUser, 'missing')).rejects.toThrow(
        NotFoundError
      );
    });

    it('throws ForbiddenError when requesting user cannot see the org', async () => {
      const target = buildUser({ organisationId: 'org-1' });
      const reqUser = buildUser({
        role: Role.OrgController,
        organisationId: 'org-2',
      });
      prismaMock.user.findUnique.mockResolvedValue(target);

      await expect(UserController.getUser(reqUser, target.id)).rejects.toThrow(
        ForbiddenError
      );
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
    it.each([Role.Admin, { set: Role.Admin }, { set: Role.Controller }])(
      'forbids an OrgController to grant role %p',
      async (role) => {
        const existing = buildUser({ organisationId: 'org-1' });
        const reqUser = buildUser({
          role: Role.OrgController,
          organisationId: 'org-1',
        });
        prismaMock.user.findUnique.mockResolvedValue(existing);

        await expect(
          UserController.update(reqUser, existing.id, { role })
        ).rejects.toThrow(ForbiddenError);
        expect(prismaMock.user.update).not.toHaveBeenCalled();
      }
    );

    it('lets any user change their own name', async () => {
      const reqUser = buildUser({ role: Role.User });
      prismaMock.user.findUnique.mockResolvedValue(reqUser);
      prismaMock.user.update.mockResolvedValue(reqUser);

      await UserController.update(reqUser, reqUser.id, {
        firstName: 'New',
        lastName: 'Name',
      });

      expect(prismaMock.user.update).toHaveBeenCalled();
    });

    it('forbids users to change anything else about themselves', async () => {
      const reqUser = buildUser({ role: Role.User });
      prismaMock.user.findUnique.mockResolvedValue(reqUser);

      await expect(
        UserController.update(reqUser, reqUser.id, {
          firstName: 'New',
          role: Role.Admin,
        })
      ).rejects.toThrow(ForbiddenError);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('updates the user without touching keycloak when no account fields change', async () => {
      const existing = buildUser({ organisationId: 'org-1' });
      const reqUser = buildUser({ role: Role.Admin });
      prismaMock.user.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, role: Role.OrgCoordinator };
      prismaMock.user.update.mockResolvedValue(updated);

      const result = await UserController.update(reqUser, existing.id, {
        role: Role.OrgCoordinator,
      });

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
        { id: existing.kcId },
        { email: 'new@example.com' }
      );
    });

    it('syncs names to keycloak before writing the db', async () => {
      const existing = buildUser();
      const reqUser = buildUser({ role: Role.Admin });
      prismaMock.user.findUnique.mockResolvedValue(existing);
      mockAdminClient.users.update.mockRejectedValue(new Error('kc down'));

      await expect(
        UserController.update(reqUser, existing.id, {
          firstName: { set: 'New' },
          lastName: null,
        })
      ).rejects.toThrow('kc down');
      expect(mockAdminClient.users.update).toHaveBeenCalledWith(
        { id: existing.kcId },
        { firstName: 'New', lastName: '' }
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('rejects changing the kcId', async () => {
      const existing = buildUser();
      const reqUser = buildUser({ role: Role.Admin });
      prismaMock.user.findUnique.mockResolvedValue(existing);

      await expect(
        UserController.update(reqUser, existing.id, { kcId: 'other' })
      ).rejects.toThrow(BadRequestError);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('rejects invalid input', async () => {
      const existing = buildUser();
      const reqUser = buildUser({ role: Role.Admin });
      prismaMock.user.findUnique.mockResolvedValue(existing);

      await expect(
        UserController.update(reqUser, existing.id, {
          role: 'Superuser',
        } as any)
      ).rejects.toThrow(ZodError);
    });

    it('throws NotFoundError when the user does not exist', async () => {
      const reqUser = buildUser({ role: Role.Admin });
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        UserController.update(reqUser, 'missing', {})
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the requester cannot edit the user', async () => {
      const existing = buildUser({ organisationId: 'org-1' });
      const reqUser = buildUser({ role: Role.User, organisationId: 'org-1' });
      prismaMock.user.findUnique.mockResolvedValue(existing);

      await expect(
        UserController.update(reqUser, existing.id, { firstName: 'New' })
      ).rejects.toThrow(ForbiddenError);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('creates a new user', async () => {
      const created = buildUser();
      prismaMock.user.create.mockResolvedValue(created);

      const result = await UserController.register({
        email: 'x@example.com',
      } as any);

      expect(result).toBe(created);
    });
  });

  describe('delete', () => {
    it('deletes the user in prisma and keycloak', async () => {
      const existing = buildUser();
      const admin = buildUser({ role: Role.Admin });
      prismaMock.user.delete.mockResolvedValue(existing);

      const result = await UserController.delete(admin, existing.id);

      expect(result).toBe(existing);
      expect(mockAdminClient.users.del).toHaveBeenCalledWith(
        expect.objectContaining({ id: existing.kcId })
      );
    });

    it('throws ForbiddenError for non-admins', async () => {
      const reqUser = buildUser({ role: Role.OrgCoordinator });

      await expect(UserController.delete(reqUser, 'some-id')).rejects.toThrow(
        ForbiddenError
      );
      expect(prismaMock.user.delete).not.toHaveBeenCalled();
      expect(mockAdminClient.users.del).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const admin = buildUser({ role: Role.Admin });
    const input = {
      email: ' New@Example.com ',
      firstName: 'New',
      lastName: 'User',
      role: Role.OrgCoordinator,
      organisationId: 'org-1',
      subOrganisationIds: ['sub-1'],
      onboarding: 'invite',
    };

    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      mockAdminClient.users.create.mockResolvedValue({ id: 'kc-new' });
      mockAdminClient.users.del.mockResolvedValue(undefined);
      prismaMock.user.delete.mockResolvedValue(undefined);
    });

    it('creates the keycloak account and app user and sends an invite', async () => {
      const created = buildUser({ kcId: 'kc-new' });
      prismaMock.user.create.mockResolvedValue(created);

      const result = await UserController.create(admin, input);

      expect(mockAdminClient.users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'new@example.com',
          email: 'new@example.com',
          enabled: true,
        })
      );
      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kcId: 'kc-new',
            email: 'new@example.com',
            role: Role.OrgCoordinator,
            organisation: { connect: { id: 'org-1' } },
            subOrganisations: { connect: [{ id: 'sub-1' }] },
          }),
        })
      );
      expect(mockAdminClient.users.executeActionsEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'kc-new',
          actions: ['UPDATE_PASSWORD', 'VERIFY_EMAIL'],
        })
      );
      expect(mockAdminClient.users.resetPassword).not.toHaveBeenCalled();
      expect(result).toEqual({ ...created, tempPassword: undefined });
    });

    it('returns the keycloak status of the new account', async () => {
      prismaMock.user.create.mockResolvedValue(buildUser({ kcId: 'kc-new' }));
      mockAdminClient.users.findOne.mockResolvedValue({
        id: 'kc-new',
        enabled: true,
        emailVerified: false,
        requiredActions: ['UPDATE_PASSWORD', 'VERIFY_EMAIL'],
      });

      const result = await UserController.create(admin, input);

      expect(result.kcStatus).toEqual({
        enabled: true,
        emailVerified: false,
        pendingActions: ['UPDATE_PASSWORD', 'VERIFY_EMAIL'],
      });
      expect(mockAdminClient.users.findOne).toHaveBeenCalledWith({
        id: 'kc-new',
      });
    });

    it('sets and returns a temporary password', async () => {
      prismaMock.user.create.mockResolvedValue(buildUser({ kcId: 'kc-new' }));

      const result = await UserController.create(admin, {
        ...input,
        onboarding: 'tempPassword',
      });

      expect(result.tempPassword).toHaveLength(16);
      expect(mockAdminClient.users.resetPassword).toHaveBeenCalledWith({
        id: 'kc-new',
        credential: {
          type: 'password',
          value: result.tempPassword,
          temporary: true,
        },
      });
      expect(mockAdminClient.users.executeActionsEmail).not.toHaveBeenCalled();
    });

    it('links an existing keycloak account instead of creating one', async () => {
      mockAdminClient.users.find.mockResolvedValue([{ id: 'kc-existing' }]);
      prismaMock.user.create.mockResolvedValue(
        buildUser({ kcId: 'kc-existing' })
      );

      await UserController.create(admin, input);

      expect(mockAdminClient.users.create).not.toHaveBeenCalled();
      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kcId: 'kc-existing' }),
        })
      );
    });

    it('throws ConflictError when the email is already used in the app', async () => {
      prismaMock.user.findUnique.mockResolvedValue(buildUser());

      await expect(UserController.create(admin, input)).rejects.toThrow(
        ConflictError
      );
      expect(mockAdminClient.users.create).not.toHaveBeenCalled();
    });

    it('throws ConflictError when the keycloak account is already linked', async () => {
      mockAdminClient.users.find.mockResolvedValue([{ id: 'kc-existing' }]);
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(buildUser({ kcId: 'kc-existing' }));

      await expect(UserController.create(admin, input)).rejects.toThrow(
        ConflictError
      );
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('deletes the new keycloak account when creating the app user fails', async () => {
      prismaMock.user.create.mockRejectedValue(new Error('db error'));

      await expect(UserController.create(admin, input)).rejects.toThrow(
        'db error'
      );
      expect(mockAdminClient.users.del).toHaveBeenCalledWith({ id: 'kc-new' });
      expect(mockAdminClient.users.executeActionsEmail).not.toHaveBeenCalled();
    });

    it('rolls back both sides when the invite fails', async () => {
      const created = buildUser({ kcId: 'kc-new' });
      prismaMock.user.create.mockResolvedValue(created);
      mockAdminClient.users.executeActionsEmail.mockRejectedValue(
        new Error('smtp error')
      );

      await expect(UserController.create(admin, input)).rejects.toThrow(
        'smtp error'
      );
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: created.id },
      });
      expect(mockAdminClient.users.del).toHaveBeenCalledWith({ id: 'kc-new' });
    });

    it('keeps a linked keycloak account on rollback', async () => {
      mockAdminClient.users.find.mockResolvedValue([{ id: 'kc-existing' }]);
      prismaMock.user.create.mockRejectedValue(new Error('db error'));

      await expect(UserController.create(admin, input)).rejects.toThrow(
        'db error'
      );
      expect(mockAdminClient.users.del).not.toHaveBeenCalled();
    });

    it('requires an organisation for org-scoped roles', async () => {
      await expect(
        UserController.create(admin, { ...input, organisationId: undefined })
      ).rejects.toThrow(ZodError);
      expect(mockAdminClient.users.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when creating users outside of org', async () => {
      const reqUser = buildUser({
        role: Role.OrgController,
        organisationId: 'other-org',
      });

      await expect(
        UserController.create(reqUser, { ...input, organisationId: 'org-1' })
      ).rejects.toThrow(ForbiddenError);
      expect(mockAdminClient.users.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError for non-admins', async () => {
      const reqUser = buildUser({
        role: Role.SubOrgCoordinator,
        organisationId: 'org-1',
      });

      await expect(UserController.create(reqUser, input)).rejects.toThrow(
        ForbiddenError
      );
      expect(mockAdminClient.users.create).not.toHaveBeenCalled();
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

  describe.each([Role.OrgController, Role.OrgCoordinator])(
    'managing users of the own org as %s',
    (role) => {
      const ownOrg = 'org-1';
      const input = {
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        role: Role.User,
        organisationId: ownOrg,
        subOrganisationIds: [],
        onboarding: 'invite',
      };
      let reqUser: ReturnType<typeof buildUser>;

      beforeEach(() => {
        reqUser = buildUser({ role, organisationId: ownOrg });
        mockAdminClient.users.create.mockResolvedValue({ id: 'kc-new' });
      });

      it('returns keycloak status with the org users', async () => {
        prismaMock.user.findMany.mockResolvedValue([
          buildUser({ organisationId: ownOrg }),
        ]);

        await UserController.getOrgUsers(reqUser, ownOrg);

        expect(mockAdminClient.users.find).toHaveBeenCalled();
      });

      it('creates a user in the own org', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue(buildUser({ kcId: 'kc-new' }));

        await UserController.create(reqUser, input);

        expect(prismaMock.user.create).toHaveBeenCalled();
      });

      it('forbids creating a user in another org', async () => {
        await expect(
          UserController.create(reqUser, {
            ...input,
            organisationId: 'org-2',
          })
        ).rejects.toThrow(ForbiddenError);
        expect(mockAdminClient.users.create).not.toHaveBeenCalled();
      });

      it.each([Role.Admin, Role.Controller])(
        'forbids creating a user with role %s',
        async (newRole) => {
          await expect(
            UserController.create(reqUser, { ...input, role: newRole })
          ).rejects.toThrow(ForbiddenError);
          expect(mockAdminClient.users.create).not.toHaveBeenCalled();
        }
      );

      it('edits a user of the own org', async () => {
        const existing = buildUser({ organisationId: ownOrg });
        prismaMock.user.findUnique.mockResolvedValue(existing);
        prismaMock.user.update.mockResolvedValue(existing);

        await UserController.update(reqUser, existing.id, {
          firstName: 'New',
        });

        expect(prismaMock.user.update).toHaveBeenCalled();
      });

      it('forbids editing a user of another org', async () => {
        const existing = buildUser({ organisationId: 'org-2' });
        prismaMock.user.findUnique.mockResolvedValue(existing);

        await expect(
          UserController.update(reqUser, existing.id, { firstName: 'New' })
        ).rejects.toThrow(ForbiddenError);
        expect(prismaMock.user.update).not.toHaveBeenCalled();
      });

      it('forbids moving a user to another org', async () => {
        const existing = buildUser({ organisationId: ownOrg });
        prismaMock.user.findUnique.mockResolvedValue(existing);

        await expect(
          UserController.update(reqUser, existing.id, {
            organisation: { connect: { id: 'org-2' } },
          })
        ).rejects.toThrow(ForbiddenError);
        expect(prismaMock.user.update).not.toHaveBeenCalled();
      });

      it.each([Role.Admin, { set: Role.Admin }, { set: Role.Controller }])(
        'forbids granting role %p',
        async (newRole) => {
          const existing = buildUser({ organisationId: ownOrg });
          prismaMock.user.findUnique.mockResolvedValue(existing);

          await expect(
            UserController.update(reqUser, existing.id, { role: newRole })
          ).rejects.toThrow(ForbiddenError);
          expect(prismaMock.user.update).not.toHaveBeenCalled();
        }
      );

      it('issues a temporary password for a user of the own org', async () => {
        const existing = buildUser({ organisationId: ownOrg });
        prismaMock.user.findUnique.mockResolvedValue(existing);

        const result = await UserController.issueTempPassword(
          reqUser,
          existing.id
        );

        expect(result.tempPassword).toEqual(expect.any(String));
      });

      it('forbids deleting users', async () => {
        await expect(
          UserController.delete(reqUser, 'some-id')
        ).rejects.toThrow(ForbiddenError);
        expect(prismaMock.user.delete).not.toHaveBeenCalled();
      });
    }
  );

  describe('resendInvite', () => {
    it('sends the invite email', async () => {
      const admin = buildUser({ role: Role.Admin });
      const target = buildUser();
      prismaMock.user.findUnique.mockResolvedValue(target);

      await UserController.resendInvite(admin, target.id);

      expect(mockAdminClient.users.executeActionsEmail).toHaveBeenCalledWith(
        expect.objectContaining({ id: target.kcId })
      );
    });

    it('throws ForbiddenError if the user cant edit', async () => {
      const user = buildUser({ organisationId: 'other-org' });
      prismaMock.user.findUnique.mockResolvedValue(user);

      await expect(
        UserController.resendInvite(
          buildUser({ role: Role.User, organisationId: 'org-1' }),
          user.id
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('issueTempPassword', () => {
    it('sets a new temporary password', async () => {
      const admin = buildUser({ role: Role.Admin });
      const target = buildUser();
      prismaMock.user.findUnique.mockResolvedValue(target);

      const { tempPassword } = await UserController.issueTempPassword(
        admin,
        target.id
      );

      expect(mockAdminClient.users.resetPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          id: target.kcId,
          credential: expect.objectContaining({ value: tempPassword }),
        })
      );
    });

    it('throws NotFoundError for unknown users', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        UserController.issueTempPassword(
          buildUser({ role: Role.Admin }),
          'missing'
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('setEnabled', () => {
    it('locks the keycloak account', async () => {
      const admin = buildUser({ role: Role.Admin });
      const target = buildUser();
      prismaMock.user.findUnique.mockResolvedValue(target);

      await UserController.setEnabled(admin, target.id, { enabled: false });

      expect(mockAdminClient.users.update).toHaveBeenCalledWith(
        { id: target.kcId },
        { enabled: false }
      );
    });

    it('does not let admins lock themselves out', async () => {
      const admin = buildUser({ role: Role.Admin });
      prismaMock.user.findUnique.mockResolvedValue(admin);

      await expect(
        UserController.setEnabled(admin, admin.id, { enabled: false })
      ).rejects.toThrow(BadRequestError);
      expect(mockAdminClient.users.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError if the user cant edit', async () => {
      const user = buildUser({ organisationId: 'other-org' });
      prismaMock.user.findUnique.mockResolvedValue(user);

      await expect(
        UserController.setEnabled(buildUser({ role: Role.User }), user.id, {
          enabled: true,
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('generateTempPassword', () => {
    it('contains every character class', () => {
      for (let i = 0; i < 50; i++) {
        const pw = generateTempPassword();
        expect(pw).toHaveLength(16);
        expect(pw).toMatch(/[A-Z]/);
        expect(pw).toMatch(/[a-z]/);
        expect(pw).toMatch(/[0-9]/);
        expect(pw).toMatch(/[!?#%+\-_]/);
      }
    });
  });
});
