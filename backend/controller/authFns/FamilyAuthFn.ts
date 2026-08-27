import { FullUser, FullFamily } from '../../../shared/types';
import { Prisma } from '../../../shared/generated/prisma/client';
import { Role } from '../../../shared/generated/prisma/client';
import { isSameOrg, isSameSubOrg } from './scopeUtils';

const CAN_OVERRIDE: Role[] = [Role.Admin];

// Controller/OrgController only ever get anonymized case/stats data, and Family has no
// anonymized form (it's all personal data - name, address, phone) - so both are fully blocked
// from it, regardless of any other role they might also hold. This mirrors how CaseAuthFns
// strips `family` from Case reads for these same two roles.
const BLOCKED_ROLES: Role[] = [Role.Controller, Role.OrgController];

function isBlocked(user: FullUser) {
  return BLOCKED_ROLES.includes(user.role);
}

export function canSeeAllFamilies(user: FullUser) {
  return user.role === Role.Admin;
}

export function canSeeFamilies(user: FullUser, families: FullFamily[]) {
  return families.every((f) => canSeeFamily(user, f));
}

export function canSeeFamily(user: FullUser, family: FullFamily) {
  if (isBlocked(user)) return false;
  if (CAN_OVERRIDE.includes(user.role)) return true;
  if (family.case?.responsibleUsers.some((ru) => ru.id === user.id))
    return true;
  // OrgCoordinator/SubOrgCoordinator: read access to all family data within their org/suborg,
  // to coordinate the other users inside it - on top of their normal-User access above.
  if (user.role === Role.OrgCoordinator)
    return isSameOrg(user, family.organisationId);
  if (user.role === Role.SubOrgCoordinator)
    return isSameSubOrg(user, family.case?.subOrganisationId);
  return false;
}

export function canEditFamily(user: FullUser, family: FullFamily) {
  if (isBlocked(user)) return false;
  if (CAN_OVERRIDE.includes(user.role)) return true;
  return (
    family.case?.responsibleUsers.some((ru) => ru.id === user.id) ?? false
  );
}

export function canCreateFamily(
  user: FullUser,
  data: Prisma.FamilyCreateInput
) {
  if (isBlocked(user)) return false;
  if (CAN_OVERRIDE.includes(user.role)) return true;

  return data.organisation?.connect?.id === user.organisationId;
}
