import { randomInt } from 'node:crypto';
import UserRepresentation from '@keycloak/keycloak-admin-client/lib/defs/userRepresentation';
import { FRONTEND_BASE_URL, KC_CLIENT } from '../config';
import getAdminClient from '../kcAdminClient';
import { prisma } from '../db';

import {
  canAccessAllUsers,
  canCreateUser,
  canEditUser,
  canManageAllUsers,
  canSeeOrgUsers,
  canSeeSubOrgUsers,
} from './authFns/UserAuthFns';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../util/authUtils';
import { Prisma } from '../../shared/generated/prisma/client';
import { UserUpdateInputObjectSchema } from '../../shared/generated/zod/schemas';
import { USER_DEFAULT_INCLUDE } from '../../shared/consts';
import {
  AdminUser,
  FullUser,
  KcStatus,
  UserWithTempPassword,
} from '../../shared/types';
import { UserCreateRequest, UserEnabledRequest } from '../../shared/zodTypes';

/** How long the link in an invite email stays valid */
const INVITE_LIFESPAN_SECONDS = 7 * 24 * 60 * 60;
const INVITE_ACTIONS = ['UPDATE_PASSWORD', 'VERIFY_EMAIL'];

const TEMP_PASSWORD_CHARSETS = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnopqrstuvwxyz',
  '23456789',
  '!?#%+-_',
];

/** Random password containing every character class, without look-alikes like 0/O or 1/l. */
export function generateTempPassword(length = 16) {
  const all = TEMP_PASSWORD_CHARSETS.join('');
  const chars = TEMP_PASSWORD_CHARSETS.map((set) => set[randomInt(set.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);

  // Fisher-Yates, so the guaranteed characters don't always lead
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function toKcStatus(kcUser: UserRepresentation): KcStatus {
  return {
    enabled: !!kcUser.enabled,
    emailVerified: !!kcUser.emailVerified,
    pendingActions: kcUser.requiredActions ?? [],
  };
}

/** Plain value of a Prisma string update field (`'x'` or `{ set: 'x' }`). */
function updateValue(field: unknown): string | null | undefined {
  if (typeof field === 'string' || field === null) return field;
  if (field && typeof field === 'object' && 'set' in field)
    return field.set as string | null;
  return undefined;
}

export class UserController {
  /**
   * Get all users
   * @param user requesting user
   * @param where [Optional] Prisma UserWhereInput
   * @returns User[]
   */
  static async getAll(
    user: FullUser,
    where?: Prisma.UserWhereInput
  ): Promise<AdminUser[]> {
    if (!canAccessAllUsers(user)) throw new ForbiddenError();

    const users = await prisma.user.findMany({
      include: USER_DEFAULT_INCLUDE,
      where,
    });
    if (!canManageAllUsers(user)) return users;

    return UserController.withKcStatus(users);
  }

  /**
   * Merges the Keycloak account state into the users. Keycloak being unreachable must not break
   * the user list, so users are returned without status in that case.
   */
  private static async withKcStatus(users: FullUser[]): Promise<AdminUser[]> {
    try {
      const adminClient = await getAdminClient();
      const kcUsers = await adminClient.users.find({
        briefRepresentation: false,
        max: 10000,
      });
      const byId = new Map(kcUsers.map((u) => [u.id, u]));

      return users.map((u) => {
        const kcUser = byId.get(u.kcId);
        return kcUser ? { ...u, kcStatus: toKcStatus(kcUser) } : u;
      });
    } catch (e) {
      console.error('could not load keycloak user status', e);
      return users;
    }
  }

  /** Single-user variant of `withKcStatus`, without loading every Keycloak account. */
  private static async withOwnKcStatus<U extends FullUser>(
    user: U
  ): Promise<U & { kcStatus?: KcStatus }> {
    try {
      const adminClient = await getAdminClient();
      const kcUser = await adminClient.users.findOne({ id: user.kcId });
      return kcUser ? { ...user, kcStatus: toKcStatus(kcUser) } : user;
    } catch (e) {
      console.error('could not load keycloak user status', e);
      return user;
    }
  }

  /**
   * Get all users in organisation
   * @param user requesting user
   * @param orgId ID of the organisation
   * @param where [Optional] Prisma UserWhereInput
   * @returns User[]
   */
  static async getOrgUsers(
    user: FullUser,
    orgId: string,
    where?: Prisma.UserWhereInput
  ) {
    if (!canSeeOrgUsers(user, orgId)) throw new ForbiddenError();

    const users = await prisma.user.findMany({
      where: { ...where, organisationId: orgId },
      include: USER_DEFAULT_INCLUDE,
    });
    return users;
  }

  /**
   * Get all users in sub_organisation
   * @param user requesting user
   * @param subOrgId ID of sub_organisation
   * @returns User[]
   */
  static async getSubOrgUsers(user: FullUser, subOrgId: string) {
    if (!(await canSeeSubOrgUsers(user, subOrgId))) throw new ForbiddenError();

    const users = await prisma.user.findMany({
      where: { subOrganisations: { some: { id: subOrgId } } },
      include: USER_DEFAULT_INCLUDE,
    });

    return users;
  }

  /**
   * Get user by User ID.
   * @param reqUser requesting user
   * @param id User ID
   * @returns User
   */
  static async getUser(reqUser: FullUser, id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: USER_DEFAULT_INCLUDE,
    });

    if (!user) throw new NotFoundError();
    if (!canSeeOrgUsers(reqUser, user.organisationId!))
      throw new ForbiddenError();
    if (!canEditUser(reqUser, user)) return user;

    return UserController.withOwnKcStatus(user);
  }

  /**
   * Get user by KeyCloak ID.
   * @param id user ID in Keycloak
   * @returns User
   */
  static async getUserByKC(id: string) {
    const user = await prisma.user.findUnique({
      where: { kcId: id },
      include: USER_DEFAULT_INCLUDE,
    });

    return user;
  }

  /**
   * Update user by ID. NOT used to update password.
   * Name and email are synced to Keycloak first, so a failing sync leaves both sides unchanged.
   * @param reqUser requesting user
   * @param id user ID
   * @param data prisma user update input
   * @returns User
   */
  static async update(
    reqUser: FullUser,
    id: string,
    data: Prisma.UserUpdateInput
  ) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: USER_DEFAULT_INCLUDE,
    });

    if (!user) throw new NotFoundError();
    if (!canEditUser(reqUser, user)) throw new ForbiddenError();

    UserUpdateInputObjectSchema.parse(data);
    if (data.kcId !== undefined)
      throw new BadRequestError('kcId cannot be changed');

    const kcUpdate: UserRepresentation = {};
    const email = updateValue(data.email);
    const firstName = updateValue(data.firstName);
    const lastName = updateValue(data.lastName);
    if (email) kcUpdate.email = email;
    if (firstName !== undefined) kcUpdate.firstName = firstName ?? '';
    if (lastName !== undefined) kcUpdate.lastName = lastName ?? '';

    if (Object.keys(kcUpdate).length > 0) {
      const adminClient = await getAdminClient();
      await adminClient.users.update({ id: user.kcId }, kcUpdate);
    }

    const update = await prisma.user.update({
      where: { id },
      data: data,
      include: USER_DEFAULT_INCLUDE,
    });

    return update;
  }

  /**
   * Creates a user in Keycloak and the app DB, so role and organisation are set before the
   * first login. An existing Keycloak account with the same email (e.g. created in the Keycloak
   * console) is linked instead of duplicated.
   * @param reqUser requesting user, must be allowed to manage users
   * @param input UserCreateRequest
   * @returns the new user, plus the temporary password if that onboarding was chosen
   */
  static async create(
    reqUser: FullUser,
    input: unknown
  ): Promise<UserWithTempPassword> {
    const data = UserCreateRequest.parse(input);
    if (!canCreateUser(reqUser, data))
      throw new ForbiddenError(
        'Nur Admins und OrgController können User erstellen'
      );

    if (await prisma.user.findUnique({ where: { email: data.email } }))
      throw new ConflictError(
        'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits'
      );

    const adminClient = await getAdminClient();
    const existing = (
      await adminClient.users.find({ email: data.email, exact: true })
    )[0];
    if (existing && (await UserController.getUserByKC(existing.id!)))
      throw new ConflictError(
        'Dieses Keycloak-Konto ist bereits mit einem Benutzer verknüpft'
      );

    const kcId =
      existing?.id ??
      (
        await adminClient.users.create({
          username: data.email,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          enabled: true,
        })
      ).id;

    let user: FullUser | undefined;
    try {
      user = await prisma.user.create({
        data: {
          kcId,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          jobTitle: data.jobTitle ?? null,
          organisation: data.organisationId
            ? { connect: { id: data.organisationId } }
            : undefined,
          subOrganisations: {
            connect: data.subOrganisationIds.map((id) => ({ id })),
          },
        },
        include: USER_DEFAULT_INCLUDE,
      });

      const tempPassword = await UserController.onboard(kcId, data.onboarding);
      return { ...(await UserController.withOwnKcStatus(user)), tempPassword };
    } catch (e) {
      // keep both sides consistent: undo what this call created
      if (user)
        await prisma.user
          .delete({ where: { id: user.id } })
          .catch((err) => console.error('rollback of app user failed', err));
      if (!existing)
        await adminClient.users
          .del({ id: kcId })
          .catch((err) =>
            console.error('rollback of keycloak user failed', err)
          );
      throw e;
    }
  }

  /**
   * Starts a user's onboarding in Keycloak.
   * - invite: Keycloak emails a link to set a password and verify the email address
   * - tempPassword: sets a temporary password that must be changed on first login
   * @returns the temporary password, if one was set
   */
  private static async onboard(
    kcId: string,
    onboarding: 'invite' | 'tempPassword'
  ): Promise<string | undefined> {
    const adminClient = await getAdminClient();

    if (onboarding === 'invite') {
      await adminClient.users.update(
        { id: kcId },
        { requiredActions: INVITE_ACTIONS }
      );
      await adminClient.users.executeActionsEmail({
        id: kcId,
        actions: INVITE_ACTIONS,
        clientId: KC_CLIENT,
        redirectUri: `${FRONTEND_BASE_URL}/`,
        lifespan: INVITE_LIFESPAN_SECONDS,
      });
      return undefined;
    }

    const tempPassword = generateTempPassword();
    await adminClient.users.resetPassword({
      id: kcId,
      credential: { type: 'password', value: tempPassword, temporary: true },
    });
    // the admin vouches for the address, there is no invite mail to verify it
    await adminClient.users.update(
      { id: kcId },
      { emailVerified: true, requiredActions: ['UPDATE_PASSWORD'] }
    );
    return tempPassword;
  }

  private static async getManagedUser(reqUser: FullUser, id: string) {
    if (!canManageAllUsers(reqUser))
      throw new ForbiddenError('Only admins can manage users');

    const user = await prisma.user.findUnique({
      where: { id },
      include: USER_DEFAULT_INCLUDE,
    });
    if (!user) throw new NotFoundError();
    return user;
  }

  /**
   * (Re)sends the invite email to set a password.
   * @param reqUser requesting user, must be allowed to manage users
   * @param id user ID
   */
  static async resendInvite(reqUser: FullUser, id: string) {
    const user = await UserController.getManagedUser(reqUser, id);
    await UserController.onboard(user.kcId, 'invite');
  }

  /**
   * Replaces the user's password with a new temporary one, to be changed on next login.
   * @param reqUser requesting user, must be allowed to manage users
   * @param id user ID
   * @returns the temporary password - it is not stored anywhere
   */
  static async issueTempPassword(reqUser: FullUser, id: string) {
    const user = await UserController.getManagedUser(reqUser, id);
    const tempPassword = await UserController.onboard(
      user.kcId,
      'tempPassword'
    );
    return { tempPassword: tempPassword! };
  }

  /**
   * Locks or unlocks the user's Keycloak account. Locked users can't log in.
   * @param reqUser requesting user, must be allowed to manage users
   * @param id user ID
   * @param input UserEnabledRequest
   */
  static async setEnabled(reqUser: FullUser, id: string, input: unknown) {
    const { enabled } = UserEnabledRequest.parse(input);
    const user = await UserController.getManagedUser(reqUser, id);
    if (!enabled && user.id === reqUser.id)
      throw new BadRequestError('Das eigene Konto kann nicht gesperrt werden');

    const adminClient = await getAdminClient();
    await adminClient.users.update({ id: user.kcId }, { enabled });

    return UserController.withOwnKcStatus(user);
  }

  /**
   * Create a new app user for an existing Keycloak account (auto-provisioning on first login)
   * @param data
   * @returns new user id
   */
  static async register(data: Prisma.UserCreateInput) {
    const user = await prisma.user.create({
      data: { ...data },
      include: USER_DEFAULT_INCLUDE,
    });
    return user;
  }

  /**
   * Deletes user by ID
   * @param requestingUser the user requesting the deletion
   * @param id user ID
   * @returns void
   */
  static async delete(requestingUser: FullUser, id: string) {
    if (!canManageAllUsers(requestingUser))
      throw new ForbiddenError('Only admins can delete users');
    const adminClient = await getAdminClient();
    const user = await prisma.user.delete({
      where: { id },
      include: USER_DEFAULT_INCLUDE,
    });
    await adminClient.users.del({ id: user.kcId });
    return user;
  }
}
