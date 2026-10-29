import { FullUser } from '../../../shared/types';
import { prisma } from '../../db';
import { Role, User } from '../../../shared/generated/prisma/client';
import { isSameOrg } from './scopeUtils';
import { UserCreateRequest } from '../../../shared/zodTypes';
import { UserUpdateInput } from '../../../shared/generated/prisma/models';

const CAN_OVERRIDE: Role[] = [Role.Admin];

export function canAccessAllUsers(user: FullUser) {
  if (CAN_OVERRIDE.includes(user.role)) return true;

  return false;
}

export function canSeeOrgUsers(user: FullUser, orgId: string) {
  if (CAN_OVERRIDE.includes(user.role)) return true;

  return user.organisationId === orgId;
}

export async function canSeeSubOrgUsers(user: FullUser, id: string) {
  const subOrg = await prisma.subOrganisation.findUniqueOrThrow({
    where: { id },
  });

  return canSeeOrgUsers(user, subOrg.organisationId);
}

export function canManageAllUsers(user: FullUser) {
  return user.role === 'Admin';
}

export function canCreateUser(user: FullUser, input: UserCreateRequest) {
  if (CAN_OVERRIDE.includes(user.role)) return true;

  return user.role === 'OrgController' && isSameOrg(user, input.organisationId);
}

/**
 * Can the user edit the userToUpdate, optionally with input
 * @param user user requesting the update
 * @param userToUpdate user to update
 * @param input optional input, orgController can't change a users org
 * @returns true when update is legal
 */
export function canEditUser(
  user: FullUser,
  userToUpdate: User,
  input?: UserUpdateInput
) {
  if (CAN_OVERRIDE.includes(user.role)) return true;

  return (
    user.role === 'OrgController' &&
    isSameOrg(user, userToUpdate.organisationId) &&
    !input?.organisation
  );
}

export function canManageOrgUsers(user: FullUser, orgId: string) {
  if (CAN_OVERRIDE.includes(user.role)) return true;

  return user.role === 'OrgController' && isSameOrg(user, orgId);
}
