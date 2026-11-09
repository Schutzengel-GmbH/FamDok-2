import { Role } from '../../../shared/generated/prisma/client';
import { FullUser } from '../../../shared/types';
import {
  KEY_MANAGER_ROLES,
  ROLES_NEEDING_KEYS,
} from '../../../shared/utils/encryptedModels';
import { isSameOrg } from './scopeUtils';

/**
 * Who may do what with an organisation's keys. Server-side checks keep honest clients in their
 * lane; the cryptography is what keeps a dishonest server out, since every key it stores is
 * sealed or wrapped for someone else.
 */

/** Whether the role holds the org data key (works with personal data, or manages the keys). */
export function roleNeedsKeys(role: Role): boolean {
  return (ROLES_NEEDING_KEYS as readonly Role[]).includes(role);
}

/** Whether the user should enrol: a key-holding role, inside an organisation. */
export function userNeedsKeys(user: Pick<FullUser, 'role' | 'organisationId'>) {
  return roleNeedsKeys(user.role) && !!user.organisationId;
}

/** Whether the user may set up, grant, revoke, rotate and read the key log of `orgId`. */
export function canManageOrgKeys(user: FullUser, orgId: string): boolean {
  return (
    (KEY_MANAGER_ROLES as readonly Role[]).includes(user.role) &&
    isSameOrg(user, orgId)
  );
}

/**
 * Whether the user may freeze or unfreeze `orgId`: its key managers, and the Admin in an
 * emergency. Freezing never touches a key, so the operator holding this power gives nothing away.
 */
export function canFreezeOrg(user: FullUser, orgId: string): boolean {
  return user.role === Role.Admin || canManageOrgKeys(user, orgId);
}
