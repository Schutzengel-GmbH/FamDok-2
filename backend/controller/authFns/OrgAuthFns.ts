import { FullUser, FullOrganisation } from '../../../shared/types';
import { Role } from '../../../shared/generated/prisma/client';

const CAN_ACCESS_ALL_ORGS: Role[] = [Role.Admin, Role.Controller];

export function canAccessAllOrgs(user: FullUser) {
  return CAN_ACCESS_ALL_ORGS.includes(user.role);
}

export function canAccessOrg(user: FullUser, org: FullOrganisation) {
  if (CAN_ACCESS_ALL_ORGS.includes(user.role)) return true;

  return user.organisationId === org.id;
}

export function canEditOrgs(user: FullUser) {
  return CAN_ACCESS_ALL_ORGS.includes(user.role);
}

export function canEditSubOrgs(user: FullUser, orgId: string) {
  if (CAN_ACCESS_ALL_ORGS.includes(user.role)) return true;

  return user.role === Role.OrgController && user.organisationId === orgId;
}
