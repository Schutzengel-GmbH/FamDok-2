import { Case, CaseAttachment, Role } from '../../../shared/generated/prisma/client';
import { FullUser } from '../../../shared/types';
import { isSameOrg, isSameSubOrg } from './scopeUtils';

// Case attachments are personal data (scanned/signed documents tied to a family) so, unlike
// the document library, Controller/OrgController never get access - there's no way to redact a
// file the way personal-data text fields on ContactDocumentation are omitted for them.
export function canSeeCaseAttachments(
  user: FullUser,
  c: Case & { responsibleUsers: { id: string }[] }
): boolean {
  if (user.role === Role.Admin) return true;
  if (user.role === Role.Controller || user.role === Role.OrgController)
    return false;
  // OrgCoordinator/SubOrgCoordinator have read access to all case data in their org/suborg,
  // same as everywhere else - not just cases they're personally responsible for.
  if (user.role === Role.OrgCoordinator) return isSameOrg(user, c.organisationId);
  if (user.role === Role.SubOrgCoordinator)
    return isSameSubOrg(user, c.subOrganisationId);
  return c.responsibleUsers.some((ru) => ru.id === user.id);
}

/**
 * Whether the user may upload a new attachment - unlike canSeeCaseAttachments, Coordinators
 * are read-only here (their org/suborg-wide access never grants write), so only Admin or an
 * actual responsible user may upload.
 */
export function canUploadCaseAttachment(
  user: FullUser,
  c: Case & { responsibleUsers: { id: string }[] }
): boolean {
  if (user.role === Role.Admin) return true;
  if (
    user.role === Role.Controller ||
    user.role === Role.OrgController ||
    user.role === Role.OrgCoordinator ||
    user.role === Role.SubOrgCoordinator
  )
    return false;
  return c.responsibleUsers.some((ru) => ru.id === user.id);
}

export function canDeleteCaseAttachment(
  user: FullUser,
  attachment: CaseAttachment,
  c: Case
): boolean {
  if (user.role === Role.Admin) return true;
  if (
    user.role === Role.Controller ||
    user.role === Role.OrgController ||
    user.role === Role.OrgCoordinator ||
    user.role === Role.SubOrgCoordinator
  )
    return false;
  return attachment.uploadedById === user.id;
}
