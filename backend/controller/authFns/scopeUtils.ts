import { FullUser } from '../../../shared/types';

/**
 * Whether `organisationId` matches the user's own organisation. Used consistently across
 * authFns files instead of repeating `user.organisationId === x.organisationId` inline, so an
 * org-scoping check can't accidentally be written differently (and inconsistently) in two
 * places for the same kind of resource.
 */
export function isSameOrg(
  user: FullUser,
  organisationId: string | null | undefined
): boolean {
  return !!organisationId && user.organisationId === organisationId;
}

/**
 * Whether `subOrganisationId` is one of the user's own suborganisations. A user can belong to
 * multiple suborganisations (many-to-many), while a scoped resource (e.g. a Case) belongs to at
 * most one, so this checks membership rather than equality.
 */
export function isSameSubOrg(
  user: FullUser,
  subOrganisationId: string | null | undefined
): boolean {
  return (
    !!subOrganisationId &&
    user.subOrganisations.some((so) => so.id === subOrganisationId)
  );
}

/**
 * Whether the user shares at least one suborganisation with `otherUser` - used where the scoped
 * resource's suborg is expressed as another user's suborg memberships (both many-to-many) rather
 * than a single id on the resource itself, e.g. a GeneralFormResponse's suborg is whichever
 * suborg(s) its author belongs to.
 */
export function sharesSubOrg(
  user: FullUser,
  otherUser: Pick<FullUser, 'subOrganisations'> | null | undefined
): boolean {
  if (!otherUser) return false;
  const ownIds = new Set(user.subOrganisations.map((so) => so.id));
  return otherUser.subOrganisations.some((so) => ownIds.has(so.id));
}
