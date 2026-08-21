import { FullUser } from '../../../shared/types';
import { prisma } from '../../db';
import { Role } from '../../../shared/generated/prisma/client';

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

export async function canManageUsers(user: FullUser) {
  return user.role === 'Admin';
}

export function canEditUser(user: FullUser, userToEdit: FullUser) {
  return CAN_OVERRIDE.includes(user.role);
}
