import {
  Case,
  Prisma,
  Role,
  User,
} from '../../../shared/generated/prisma/client';
import { FullUser } from '../../../shared/types';
import {
  CASE_DEFAULT_INCLUDE,
  CONTACT_DOCUMENTATION_DEFAULT_INCLUDE,
  USER_DEFAULT_INCLUDE,
} from '../../../shared/consts';
import { isSameOrg, isSameSubOrg } from './scopeUtils';
import {
  CaseWhere,
  ContactDocumentationWhere,
  HandoverRequest,
} from '../../../shared/api';
import {
  allInOrg,
  isOrgCoordinatorFor,
  isResponsibleFor,
  isSubOrgCoordinatorFor,
} from '../../util/authUtils';
import { prisma } from '../../db';

// Controllers only ever get anonymized/read-only access to case data - they must never be
// able to create, edit, close, or hand over a case, even though they can see one.
const READ_OVERRIDE_ROLES: Role[] = [Role.Admin, Role.Controller];
const WRITE_OVERRIDE_ROLES: Role[] = [Role.Admin];
// OrgController is "Controller, but limited to their own org" - same anonymized-only access,
// just additionally org-scoped by canSeeCase above. Also the set of roles for which
// util/anonymizeUsers.ts strips identifying fields off every embedded User in a response.
export const ANONYMIZED_ROLES: Role[] = [Role.Controller, Role.OrgController];

type CaseWithScope = Prisma.CaseGetPayload<{
  include: { responsibleUsers: true };
}>;

export function canSeeCase(user: FullUser, c: CaseWithScope): boolean {
  if (READ_OVERRIDE_ROLES.includes(user.role)) return true;
  if (user.role === Role.OrgController)
    return isSameOrg(user, c.organisationId);
  // OrgCoordinator/SubOrgCoordinator: same as normal Users below, plus read access to all
  // case data within their org/suborg to coordinate other users.
  if (user.role === Role.OrgCoordinator)
    return isSameOrg(user, c.organisationId);
  if (user.role === Role.SubOrgCoordinator)
    return isSameSubOrg(user, c.subOrganisationId);
  return c.responsibleUsers?.some((ru) => ru.id === user.id) ?? false;
}

/**
 * Whether the user may export a case's full, non-anonymized data (Stammdaten PDF / case ZIP).
 * Unlike canSeeCase, Controller/OrgController are excluded - they only ever get anonymized data.
 */
export function canExportCase(user: FullUser, c: CaseWithScope): boolean {
  if (user.role === Role.Admin) return true;
  if (c.responsibleUsers?.some((ru) => ru.id === user.id)) return true;
  if (user.role === Role.OrgCoordinator)
    return isSameOrg(user, c.organisationId);
  if (user.role === Role.SubOrgCoordinator)
    return isSameSubOrg(user, c.subOrganisationId);
  return false;
}

/**
 * {@link canSeeCase} as a filter. Lists always apply it, so a client-supplied filter can only ever
 * match what the user may see, and can't be used to probe the rest.
 */
export function visibleCaseWhere(user: FullUser): Prisma.CaseWhereInput {
  if (READ_OVERRIDE_ROLES.includes(user.role)) return {};
  if (user.role === Role.OrgController || user.role === Role.OrgCoordinator)
    return orgCaseWhere(user);
  if (user.role === Role.SubOrgCoordinator) return subOrgCaseWhere(user);
  return { responsibleUsers: { some: { id: user.id } } };
}

export function orgCaseWhere(user: FullUser): Prisma.CaseWhereInput {
  return { organisationId: { in: user.organisationId ? [user.organisationId] : [] } };
}

export function subOrgCaseWhere(user: FullUser): Prisma.CaseWhereInput {
  return { subOrganisationId: { in: user.subOrganisations.map((so) => so.id) } };
}

export function canEditCase(
  user: User,
  c: Case & { responsibleUsers: { id: string }[] }
): boolean {
  if (WRITE_OVERRIDE_ROLES.includes(user.role)) return true;
  if (!c.responsibleUsers) return false;
  return c.responsibleUsers.some((ru) => ru.id === user.id);
}

export function canSeeCases(user: FullUser, cases: CaseWithScope[]): boolean {
  return cases.every((c) => canSeeCase(user, c));
}

export type MyCasesScope = 'own' | 'org' | 'subOrg';

/**
 * The mandatory Case where-filter for a "my cases" request with the given scope - `null` if the
 * user isn't allowed to request that scope (e.g. anyone but OrgCoordinator requesting 'org'), so
 * the caller can tell "not permitted" apart from "no filter" and must reject the request rather
 * than silently falling back to something else. 'own' is always available and mirrors the
 * dashboard's original behaviour of only ever showing cases the user is responsible for.
 */
export function myCasesScopeFilter(
  user: FullUser,
  scope: MyCasesScope
): Prisma.CaseWhereInput | null {
  switch (scope) {
    case 'own':
      return { responsibleUsers: { some: { id: user.id } } };
    case 'org':
      if (user.role !== Role.OrgCoordinator || !user.organisationId)
        return null;
      return { organisationId: user.organisationId };
    case 'subOrg': {
      if (user.role !== Role.SubOrgCoordinator) return null;
      const subOrganisationIds = user.subOrganisations.map((so) => so.id);
      return subOrganisationIds.length > 0
        ? { subOrganisationId: { in: subOrganisationIds } }
        : null;
    }
  }
}

export async function canHandover(
  user: FullUser,
  c: Case & { responsibleUsers: { id: string }[] },
  handover: HandoverRequest
) {
  const canAccess =
    isResponsibleFor(user, c) ||
    isOrgCoordinatorFor(user, c) ||
    isSubOrgCoordinatorFor(user, c);
  if (!canAccess) return false;

  const notEmptyAfter =
    c.responsibleUsers
      .map((c) => c.id)
      .concat(handover.addedIds)
      .filter((id) => !handover.removedIds.includes(id)).length > 0;

  const addedUsers = await Promise.all(
    handover.addedIds.map((id) => {
      return prisma.user.findUniqueOrThrow({ where: { id } });
    })
  );

  const noRemoval = !handover.removedIds || handover.removedIds.length === 0;

  const canRemove =
    noRemoval ||
    (handover.removedIds.length === 1 && handover.removedIds[0] === user.id) ||
    user.role === 'OrgCoordinator' ||
    user.role === 'SubOrgCoordinator';

  const allAreInOrg = await allInOrg(addedUsers, c.organisationId);

  return notEmptyAfter && canRemove && allAreInOrg;
}

/**
 * Builds the Case `include` to use for a given user, merging in any caller-requested `extra`
 * include - but for Controller/OrgController, always strips the attached family and the
 * personal-data fields on nested contact documentation afterwards, so a caller-supplied `extra`
 * can never override that restriction.
 */
export function caseIncludeFor(
  user: FullUser,
  extra?: Prisma.CaseInclude
): Prisma.CaseInclude {
  const merged: Prisma.CaseInclude = { ...CASE_DEFAULT_INCLUDE, ...extra };
  if (!ANONYMIZED_ROLES.includes(user.role)) return merged;

  const contactDocumentationExtra =
    typeof merged.contactDocumentation === 'object' &&
    merged.contactDocumentation
      ? merged.contactDocumentation
      : {};

  return {
    ...merged,
    family: false,
    contactDocumentation: {
      ...contactDocumentationExtra,
      omit: {
        ...(contactDocumentationExtra as { omit?: Record<string, boolean> })
          .omit,
        zusammenfassung: true,
        dokumentation: true,
      },
    },
  };
}

/**
 * Builds the top-level `include`/`omit` query args to use when directly querying
 * ContactDocumentation for a given user - for Controller/OrgController, zusammenfassung and
 * dokumentation are always omitted, and the nested case never carries its family.
 */
export function contactDocumentationQueryArgsFor(user: FullUser): {
  include: Prisma.ContactDocumentationInclude;
  omit?: Prisma.ContactDocumentationOmit;
} {
  if (!ANONYMIZED_ROLES.includes(user.role)) {
    return { include: CONTACT_DOCUMENTATION_DEFAULT_INCLUDE };
  }

  return {
    include: {
      createdBy: { include: USER_DEFAULT_INCLUDE },
      case: { include: caseIncludeFor(user) },
    },
    omit: { zusammenfassung: true, dokumentation: true },
  };
}

/**
 * Drops what Controller/OrgController must not filter by: they can't see a case's family, so
 * probing names via `family: { name: { contains: "..." } }` and observing which cases match
 * would leak the same data through a side channel. No-op for every other role.
 */
export function caseWhereFor(
  user: FullUser,
  where?: CaseWhere
): CaseWhere | undefined {
  if (!where || !ANONYMIZED_ROLES.includes(user.role)) return where;
  const { family, ...rest } = where;
  return rest;
}

/** Same as {@link caseWhereFor}, for the personal-data fields of contact documentation. */
export function contactDocWhereFor(
  user: FullUser,
  where?: ContactDocumentationWhere
): ContactDocumentationWhere | undefined {
  if (!where || !ANONYMIZED_ROLES.includes(user.role)) return where;
  const { zusammenfassung, dokumentation, ...rest } = where;
  return { ...rest, case: caseWhereFor(user, where.case) };
}
