import { CASE_DEFAULT_INCLUDE } from '../../../shared/consts';
import { FullCaseFormResponse, FullUser } from '../../../shared/types';
import { prisma } from '../../db';
import { Prisma } from '../../../shared/generated/prisma/client';
import { Role } from '../../../shared/generated/prisma/client';
import { isSameOrg, isSameSubOrg } from './scopeUtils';
import { orgCaseWhere, subOrgCaseWhere } from './CaseAuthFns';

const WRITE_OVERRIDE_ROLES: Role[] = [Role.Admin];

type FamilyMembers = { childId?: string | null; caregiverId?: string | null };

/** Whether the child and caregiver a response is about belong to the family of its case. */
export function isFamilyMember(
  family: { children: { id: string }[]; caregiver: { id: string }[] } | null,
  { childId, caregiverId }: FamilyMembers
) {
  return (
    (!childId || !!family?.children.some((c) => c.id === childId)) &&
    (!caregiverId || !!family?.caregiver.some((c) => c.id === caregiverId))
  );
}

export async function canCreateCaseFormResponse(
  user: FullUser,
  data: FamilyMembers & { caseId: string }
) {
  const c = await prisma.case.findUnique({
    where: { id: data.caseId },
    include: CASE_DEFAULT_INCLUDE,
  });
  if (!c) return false;
  return (
    c.responsibleUsers.some((ru) => ru.id === user.id) &&
    isFamilyMember(c.family, data)
  );
}

/**
 * Evaluated per-response (not once for a whole batch) since `getWhere` can return responses
 * belonging to different CaseForms/Cases in one call - checking only the first response's
 * CaseForm and applying that to the rest would leak responses that don't share its scope.
 */
function canSeeSingleCaseFormResponse(
  user: FullUser,
  response: FullCaseFormResponse
): boolean {
  if (user.role === Role.Admin) return true;
  if (response.case.responsibleUsers.some((ru) => ru.id === user.id))
    return true;

  const caseForm = response.caseForm;
  if (!caseForm) return false;

  // Controller/OrgController only ever see data that has no personal data - OrgController is
  // additionally limited to their own organisation's cases.
  if (!caseForm.containsPersonalData) {
    if (user.role === Role.Controller) return true;
    if (user.role === Role.OrgController)
      return isSameOrg(user, response.case.organisationId);
  }

  // Coordinators have read access to all of their org's/suborg's case data, regardless of
  // containsPersonalData.
  if (user.role === Role.OrgCoordinator)
    return isSameOrg(user, response.case.organisationId);
  if (user.role === Role.SubOrgCoordinator)
    return isSameSubOrg(user, response.case.subOrganisationId);

  return false;
}

/** {@link canSeeSingleCaseFormResponse} as a filter, see {@link visibleCaseWhere}. */
export function visibleCaseFormResponseWhere(
  user: FullUser
): Prisma.CaseFormResponseWhereInput {
  if (user.role === Role.Admin) return {};

  const noPersonalData = { caseForm: { containsPersonalData: false } };
  const OR: Prisma.CaseFormResponseWhereInput[] = [
    { case: { responsibleUsers: { some: { id: user.id } } } },
  ];

  if (user.role === Role.Controller) OR.push(noPersonalData);
  if (user.role === Role.OrgController)
    OR.push({ ...noPersonalData, case: orgCaseWhere(user) });
  if (user.role === Role.OrgCoordinator) OR.push({ case: orgCaseWhere(user) });
  if (user.role === Role.SubOrgCoordinator)
    OR.push({ case: subOrgCaseWhere(user) });

  return { OR };
}

export function canSeeCaseFormResponse(
  user: FullUser,
  response: FullCaseFormResponse
) {
  return canSeeSingleCaseFormResponse(user, response);
}

export function canSeeCaseFormResponses(
  user: FullUser,
  responses: FullCaseFormResponse[]
) {
  return responses.every((r) => canSeeSingleCaseFormResponse(user, r));
}

export function canEditCaseFormResponse(
  user: FullUser,
  response: FullCaseFormResponse
) {
  if (WRITE_OVERRIDE_ROLES.includes(user.role)) return true;
  return response.case.responsibleUsers.some((ru) => ru.id === user.id);
}
