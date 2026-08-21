import { FullUser } from '../../../shared/types';
import { Prisma, Role } from '../../../shared/generated/prisma/client';
import { isSameOrg } from './scopeUtils';

const CAN_MANAGE_ALL_FORMS_ROLES: Role[] = [Role.Admin, Role.Controller];

/** Whether the user can manage forms without any org restriction. */
export function canEdit(user: FullUser) {
  return CAN_MANAGE_ALL_FORMS_ROLES.includes(user.role);
}

/**
 * Whether the user can create a new CaseForm with the given data - OrgController may only
 * create forms scoped to their own organisation, never global ones or another org's.
 */
export function canCreateCaseForm(
  user: FullUser,
  data: Prisma.CaseFormCreateInput
) {
  if (canEdit(user)) return true;
  if (user.role !== Role.OrgController) return false;
  return data.organisation?.connect?.id === user.organisationId;
}

/**
 * Whether the user can update/delete an existing CaseForm - OrgController may only manage
 * forms already scoped to their own organisation, never global forms or another org's.
 */
export function canEditCaseForm(
  user: FullUser,
  form: { organisationId: string | null }
) {
  if (canEdit(user)) return true;
  if (user.role !== Role.OrgController) return false;
  return isSameOrg(user, form.organisationId);
}

const ANONYMIZED_ROLES: Role[] = [Role.Controller, Role.OrgController];

/**
 * Additional where-clause restrictions to enforce for a given user when listing case form
 * definitions, regardless of what the caller requests:
 * - Controller/OrgController must never see definitions for forms that contain personal data
 *   (same anonymized-only restriction as everywhere else for these two roles).
 * - Everyone but Admin/Controller only sees global forms plus their own org's forms.
 */
export function caseFormWhereRestrictions(
  user: FullUser
): Prisma.CaseFormWhereInput[] {
  const restrictions: Prisma.CaseFormWhereInput[] = [];

  if (ANONYMIZED_ROLES.includes(user.role)) {
    restrictions.push({ containsPersonalData: { not: true } });
  }

  if (!CAN_MANAGE_ALL_FORMS_ROLES.includes(user.role)) {
    restrictions.push({
      OR: [{ organisationId: null }, { organisationId: user.organisationId }],
    });
  }

  return restrictions;
}
