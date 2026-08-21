import { FullUser } from '../../../shared/types';
import { Prisma, Role } from '../../../shared/generated/prisma/client';

const OVERRIDE_ROLES: Role[] = [Role.Admin, Role.Controller];
const SCOPED_ROLES: Role[] = [
  Role.OrgController,
  Role.OrgCoordinator,
  Role.SubOrgCoordinator,
];

export function canAccessAllStats(user: FullUser) {
  return OVERRIDE_ROLES.includes(user.role);
}

/** Whether the user can access stats, restricted to their own org's/suborg's data. */
export function canAccessScopedStats(user: FullUser) {
  return SCOPED_ROLES.includes(user.role);
}

type OrgScope =
  | { kind: 'org'; organisationId: string }
  | { kind: 'subOrg'; subOrganisationIds: string[] };

function resolveOrgScope(user: FullUser): OrgScope | null {
  if (user.role === Role.OrgController || user.role === Role.OrgCoordinator) {
    return user.organisationId
      ? { kind: 'org', organisationId: user.organisationId }
      : null;
  }
  if (user.role === Role.SubOrgCoordinator) {
    const subOrganisationIds = user.subOrganisations.map((so) => so.id);
    return subOrganisationIds.length > 0
      ? { kind: 'subOrg', subOrganisationIds }
      : null;
  }
  return null;
}

/**
 * The mandatory Case where-filter for a scoped-access user (null if they have no valid scope,
 * e.g. an OrgController with no organisation assigned - the caller should treat that as
 * forbidden, never as "no filter"). Must always be merged into the query itself rather than
 * validated against an already-fetched result, since stats are aggregate counts.
 */
export function scopedStatsCaseFilter(
  user: FullUser
): Prisma.CaseWhereInput | null {
  const scope = resolveOrgScope(user);
  if (!scope) return null;
  return scope.kind === 'org'
    ? { organisationId: scope.organisationId }
    : { subOrganisationId: { in: scope.subOrganisationIds } };
}

/** Same as {@link scopedStatsCaseFilter}, but expressed as a User filter (org/suborg
 * membership) for resources scoped via their creator rather than via a Case, e.g.
 * GeneralFormResponse. */
export function scopedStatsUserFilter(
  user: FullUser
): Prisma.UserWhereInput | null {
  const scope = resolveOrgScope(user);
  if (!scope) return null;
  return scope.kind === 'org'
    ? { organisationId: scope.organisationId }
    : { subOrganisations: { some: { id: { in: scope.subOrganisationIds } } } };
}
