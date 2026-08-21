import {
  Case,
  Handover,
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
  if (user.role === Role.OrgController) return isSameOrg(user, c.organisationId);
  // OrgCoordinator/SubOrgCoordinator: same as normal Users below, plus read access to all
  // case data within their org/suborg to coordinate other users.
  if (user.role === Role.OrgCoordinator) return isSameOrg(user, c.organisationId);
  if (user.role === Role.SubOrgCoordinator)
    return isSameSubOrg(user, c.subOrganisationId);
  return c.responsibleUsers?.some((ru) => ru.id === user.id) ?? false;
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

export function canCreate(user: User, input: Prisma.CaseCreateInput): boolean {
  if (WRITE_OVERRIDE_ROLES.includes(user.role)) return true;
  if (input.organisation?.connect?.id != user.organisationId) return false;
  if (input.createdBy?.connect?.id != user.id) return false;
  return true;
}

export function canHandover(
  user: User,
  c: Case & { responsibleUsers: { id: string }[] },
  handover: Handover
): boolean {
  if (
    !c.responsibleUsers.find((u) => u.id === user.id) &&
    user.role !== 'Admin'
  )
    return false;

  const useridsAfterHandover = c.responsibleUsers
    .map((c) => c.id)
    .concat(handover.addedIds)
    .filter((id) => !handover.removedIds.includes(id));
  if (useridsAfterHandover.length < 1) return false;

  return true;
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
 * Sanitizes a Case `where` filter for a given user - for Controller/OrgController, strips
 * `family` (they can't see it, so they must not be able to filter/search by it either - e.g.
 * probing family names via `family: { name: { contains: "..." } }` and observing which cases
 * match would leak the same data through a side channel) and recurses into AND/OR/NOT and the
 * nested `contactDocumentation` relation (which could otherwise be used to reach the same
 * restriction from the other side, or to filter contact docs by their personal-data fields).
 * No-op for every other role.
 */
export function caseWhereFor(
  user: FullUser,
  where?: Prisma.CaseWhereInput
): Prisma.CaseWhereInput | undefined {
  if (!where || !ANONYMIZED_ROLES.includes(user.role)) return where;
  return sanitizeCaseWhere(where);
}

/**
 * Sanitizes a ContactDocumentation `where` filter for a given user - for Controller/
 * OrgController, strips `zusammenfassung`/`dokumentation` and recurses into AND/OR/NOT and the
 * nested `case` relation (so a case's family can't be reached by filtering contact docs through
 * it either). No-op for every other role.
 */
export function contactDocWhereFor(
  user: FullUser,
  where?: Prisma.ContactDocumentationWhereInput
): Prisma.ContactDocumentationWhereInput | undefined {
  if (!where || !ANONYMIZED_ROLES.includes(user.role)) return where;
  return sanitizeContactDocWhere(where);
}

function sanitizeCaseWhere(
  where: Prisma.CaseWhereInput
): Prisma.CaseWhereInput {
  const { family, AND, OR, NOT, contactDocumentation, ...rest } = where;

  return {
    ...rest,
    ...(AND !== undefined && { AND: mapWhereList(AND, sanitizeCaseWhere) }),
    ...(OR !== undefined && { OR: OR.map(sanitizeCaseWhere) }),
    ...(NOT !== undefined && { NOT: mapWhereList(NOT, sanitizeCaseWhere) }),
    ...(contactDocumentation !== undefined && {
      contactDocumentation: sanitizeListRelationFilter(
        contactDocumentation,
        sanitizeContactDocWhere
      ),
    }),
  };
}

function sanitizeContactDocWhere(
  where: Prisma.ContactDocumentationWhereInput
): Prisma.ContactDocumentationWhereInput {
  const {
    zusammenfassung,
    dokumentation,
    AND,
    OR,
    NOT,
    case: caseFilter,
    ...rest
  } = where;

  return {
    ...rest,
    ...(AND !== undefined && {
      AND: mapWhereList(AND, sanitizeContactDocWhere),
    }),
    ...(OR !== undefined && { OR: OR.map(sanitizeContactDocWhere) }),
    ...(NOT !== undefined && {
      NOT: mapWhereList(NOT, sanitizeContactDocWhere),
    }),
    ...(caseFilter !== undefined && {
      case: sanitizeScalarRelationFilter(caseFilter, sanitizeCaseWhere),
    }),
  };
}

function mapWhereList<T>(value: T | T[], fn: (v: T) => T): T | T[] {
  return Array.isArray(value) ? value.map(fn) : fn(value);
}

/** Sanitizes the `every`/`some`/`none` where-inputs of a to-many relation filter. */
function sanitizeListRelationFilter<Filter extends Record<string, unknown>>(
  filter: Filter,
  sanitize: (w: any) => any
): Filter {
  const sanitized: Record<string, unknown> = { ...filter };
  for (const key of ['every', 'some', 'none'] as const) {
    if (sanitized[key] !== undefined) sanitized[key] = sanitize(sanitized[key]);
  }
  return sanitized as Filter;
}

/** Sanitizes a required to-one relation filter, which may be a plain where-input, or `{is}`/`{isNot}`. */
function sanitizeScalarRelationFilter<Filter extends Record<string, unknown>>(
  filter: Filter,
  sanitize: (w: any) => any
): Filter {
  if ('is' in filter || 'isNot' in filter) {
    const sanitized: Record<string, unknown> = { ...filter };
    if (sanitized['is'] !== undefined) sanitized['is'] = sanitize(sanitized['is']);
    if (sanitized['isNot'] !== undefined)
      sanitized['isNot'] = sanitize(sanitized['isNot']);
    return sanitized as Filter;
  }
  return sanitize(filter);
}
