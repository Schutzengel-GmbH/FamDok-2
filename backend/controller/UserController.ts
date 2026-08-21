import { KC_REALM } from '../config';
import getAdminClient from '../kcAdminClient';
import { prisma } from '../db';

import {
  canAccessAllUsers,
  canEditUser,
  canManageUsers,
  canSeeOrgUsers,
  canSeeSubOrgUsers,
} from './authFns/UserAuthFns';
import { ForbiddenError, NotFoundError } from '../util/authUtils';
import { Prisma } from '../../shared/generated/prisma/client';
import { USER_DEFAULT_INCLUDE } from '../../shared/consts';
import { FullUser } from '../../shared/types';

export class UserController {
  /**
   * Get all users
   * @param user requesting user
   * @param where [Optional] Prisma UserWhereInput
   * @returns User[]
   */
  static async getAll(user: FullUser, where?: Prisma.UserWhereInput) {
    if (!canAccessAllUsers(user)) throw new ForbiddenError();

    const users = await prisma.user.findMany({
      include: USER_DEFAULT_INCLUDE,
      where,
    });
    return users;
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

    return user;
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

    const update = await prisma.user.update({
      where: { id },
      data: data,
      include: USER_DEFAULT_INCLUDE,
    });
    if (data.email) {
      const adminClient = await getAdminClient();
      await adminClient.users.update(
        { id, realm: KC_REALM },
        { email: data.email.toString() }
      );
    }

    return update;
  }

  // TODO:
  // - Actual user registration workflow
  // - reset password workflow
  // - update self workflow

  /**
   * Create a new user
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
    if (!canManageUsers(requestingUser))
      throw new ForbiddenError('Only admins can delete users');
    const adminClient = await getAdminClient();
    const user = await prisma.user.delete({
      where: { id },
      include: USER_DEFAULT_INCLUDE,
    });
    await adminClient.users.del({ id: user.kcId, realm: KC_REALM });
    return user;
  }
}
