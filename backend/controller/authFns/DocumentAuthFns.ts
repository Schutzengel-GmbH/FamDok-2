import { Role, User } from '../../../shared/generated/prisma/client';

// The document library holds non-personal reference material (info sheets, consent form
// templates), so unlike Case data, every role - including Controller - can read it.
export function canSeeDocuments(_user: User): boolean {
  return true;
}

export function canManageDocuments(user: User): boolean {
  return user.role === Role.Admin;
}
