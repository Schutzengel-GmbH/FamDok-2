import { Case, User } from '../../shared/generated/prisma/client';
import { FullUser } from '../../shared/types';

export class BadRequestError extends Error {}
export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}
export class NotFoundError extends Error {}
export class InternalServerError extends Error {}

export function isResponsibleFor(
  user: FullUser,
  c: Case & { responsibleUsers: { id: string }[] }
) {
  return !!c.responsibleUsers.find((u) => u.id === user.id);
}

export function isOrgCoordinatorFor(
  user: FullUser,
  c: Case & { responsibleUsers: { id: string }[] }
) {
  return (
    user.role === 'OrgCoordinator' && user.organisationId === c.organisationId
  );
}

export function isSubOrgCoordinatorFor(
  user: FullUser,
  c: Case & { responsibleUsers: { id: string }[] }
) {
  return (
    user.role === 'SubOrgCoordinator' &&
    !!user.subOrganisations.find((s) => s.id === c.subOrganisationId)
  );
}

export async function allInOrg(users: User[], orgId: string) {
  return users.every((u) => {
    return u.organisationId === orgId;
  });
}
