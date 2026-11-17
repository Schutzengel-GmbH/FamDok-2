import { FullUser } from '../../../shared/types';
import { prisma } from '../../db';
import { Role, User } from '../../../shared/generated/prisma/client';
import { isSameOrg } from './scopeUtils';
import {
  ROLES_WITHOUT_ORG,
  UserCreateRequest,
  UserUpdateRequest,
} from '../../../shared/api';

const CAN_OVERRIDE: Role[] = [Role.Admin];

const CAN_MANAGE_OWN_ORG_USERS: Role[] = [
  Role.OrgController,
  Role.OrgCoordinator,
];

// org-scoped managers may neither grant these roles nor touch users that have them
const OUTRANKS_ORG_MANAGERS: Role[] = [...ROLES_WITHOUT_ORG];

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

  return (
    CAN_MANAGE_OWN_ORG_USERS.includes(user.role) &&
    isSameOrg(user, input.organisationId) &&
    !OUTRANKS_ORG_MANAGERS.includes(input.role)
  );
}

/**
 * Can the user edit the userToUpdate, optionally with input
 * @param user user requesting the update
 * @param userToUpdate user to update
 * @param input optional input, orgController/orgCoordinator can't change a users org
 * @returns true when update is legal
 */
export function canEditUser(
  user: FullUser,
  userToUpdate: User,
  input?: UserUpdateRequest
) {
  if (CAN_OVERRIDE.includes(user.role)) return true;
  if (isOwnNameUpdate(user, userToUpdate, input)) return true;

  const role = input?.role;
  const organisationId = input?.organisationId;

  return (
    CAN_MANAGE_OWN_ORG_USERS.includes(user.role) &&
    isSameOrg(user, userToUpdate.organisationId) &&
    !OUTRANKS_ORG_MANAGERS.includes(userToUpdate.role) &&
    (organisationId === undefined || organisationId === user.organisationId) &&
    (!role || !OUTRANKS_ORG_MANAGERS.includes(role)) &&
    // the edit form always sends the role, so only an actual change counts
    (user.id !== userToUpdate.id || !role || role === userToUpdate.role)
  );
}

/** every user may change their own name, but nothing else about themselves */
function isOwnNameUpdate(
  user: FullUser,
  userToUpdate: User,
  input?: UserUpdateRequest
) {
  return (
    !!input &&
    user.id === userToUpdate.id &&
    Object.keys(input).every((key) => key === 'firstName' || key === 'lastName')
  );
}

export function canManageOrgUsers(user: FullUser, orgId: string) {
  if (CAN_OVERRIDE.includes(user.role)) return true;

  return CAN_MANAGE_OWN_ORG_USERS.includes(user.role) && isSameOrg(user, orgId);
}
