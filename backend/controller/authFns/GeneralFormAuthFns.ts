import { FullUser, FullGeneralFormResponse } from '../../../shared/types';
import { Prisma, Role } from '../../../shared/generated/prisma/client';
import { isSameOrg, sharesSubOrg } from './scopeUtils';

const CAN_CREATE: Role[] = [Role.Admin];
const CAN_SEEALL: Role[] = [Role.Admin, Role.Controller];
// Only roles with an explicit org-coordination mandate get same-org visibility into other
// users' general form responses - a plain User in the same org must not see them.
const ORG_SCOPED_ROLES: Role[] = [Role.OrgController, Role.OrgCoordinator];
const CAN_MANAGE_ALL_FORMS_ROLES: Role[] = [Role.Admin, Role.Controller];

/** Whether the user can manage forms without any org restriction. */
export function canEditGeneralFormDefinition(user: FullUser) {
  return CAN_MANAGE_ALL_FORMS_ROLES.includes(user.role);
}

/**
 * Whether the user can create a new GeneralForm - for an OrgController, it is always scoped to
 * their own organisation, never global or another org's.
 */
export function canCreateGeneralForm(user: FullUser) {
  if (canEditGeneralFormDefinition(user)) return true;
  return user.role === Role.OrgController && !!user.organisationId;
}

/**
 * Whether the user can update/delete an existing GeneralForm - OrgController may only manage
 * forms already scoped to their own organisation, never global forms or another org's.
 */
export function canEditGeneralForm(
  user: FullUser,
  form: { organisationId: string | null }
) {
  if (canEditGeneralFormDefinition(user)) return true;
  if (user.role !== Role.OrgController) return false;
  return isSameOrg(user, form.organisationId);
}

/**
 * Additional where-clause restrictions to enforce when listing general form definitions,
 * regardless of what the caller requests: everyone but Admin/Controller only sees global forms
 * plus their own org's forms.
 */
export function generalFormWhereRestrictions(
  user: FullUser
): Prisma.GeneralFormWhereInput[] {
  if (CAN_MANAGE_ALL_FORMS_ROLES.includes(user.role)) return [];
  return [{ OR: [{ organisationId: null }, { organisationId: user.organisationId }] }];
}

export function canSeeGeneralFormResponse(
  user: FullUser,
  response: FullGeneralFormResponse
) {
  if (CAN_SEEALL.includes(user.role)) return true;
  if (response.createdBy?.id === user.id) return true;
  if (ORG_SCOPED_ROLES.includes(user.role))
    return isSameOrg(user, response.createdBy?.organisationId);
  if (user.role === Role.SubOrgCoordinator)
    return sharesSubOrg(user, response.createdBy);
  return false;
}

/** {@link canSeeGeneralFormResponse} as a filter, see `visibleCaseWhere`. */
export function visibleGeneralFormResponseWhere(
  user: FullUser
): Prisma.GeneralFormResponseWhereInput {
  if (CAN_SEEALL.includes(user.role)) return {};

  const OR: Prisma.GeneralFormResponseWhereInput[] = [{ userId: user.id }];

  if (ORG_SCOPED_ROLES.includes(user.role) && user.organisationId)
    OR.push({ createdBy: { organisationId: user.organisationId } });
  if (user.role === Role.SubOrgCoordinator) {
    const id = { in: user.subOrganisations.map((so) => so.id) };
    OR.push({ createdBy: { subOrganisations: { some: { id } } } });
  }

  return { OR };
}

export function canSeeGeneralFormResponses(
  user: FullUser,
  responses: FullGeneralFormResponse[]
) {
  return responses.every((r) => canSeeGeneralFormResponse(user, r));
}

export function canEditGeneralFormResponse(
  user: FullUser,
  response: FullGeneralFormResponse
) {
  if (CAN_CREATE.includes(user.role)) return true;
  return response.createdBy?.id === user.id;
}
