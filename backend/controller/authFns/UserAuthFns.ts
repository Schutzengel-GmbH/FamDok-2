import { FullUser } from '../../../shared/types';
import { prisma } from '../../db';
import { Role, User } from '../../../shared/generated/prisma/client';
import { isSameOrg } from './scopeUtils';
import { UserCreateRequest } from '../../../shared/zodTypes';

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

export function canManageOrgUsers(user: FullUser, orgId: string) {
  if (CAN_OVERRIDE.includes(user.role)) return true;

  return user.role === 'OrgController' && isSameOrg(user, orgId);
}

export function canEditUser(user: FullUser, userToEdit: FullUser) {
  if (CAN_OVERRIDE.includes(user.role)) return true;

  return (
    user.role === 'OrgController' && isSameOrg(user, userToEdit.organisationId)
  );
}
