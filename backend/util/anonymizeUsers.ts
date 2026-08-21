import { FullUser } from '../../shared/types';
import { ANONYMIZED_ROLES } from '../controller/authFns/CaseAuthFns';

/**
 * Response keys that ever carry an embedded User (or array of Users) - every relation in the
 * schema pointing at User is named one of these (createdBy, responsibleUsers, uploadedBy), so
 * matching on the key name (rather than guessing from the value's shape) reliably finds every
 * embedded user anywhere in a response body, no matter how deeply nested.
 */
const USER_RELATION_KEYS = new Set(['createdBy', 'responsibleUsers', 'uploadedBy']);

/** Fields stripped off an embedded User for an anonymized role - keep this in sync with the
 * `AnonUser` type in shared/types.d.ts. */
const IDENTIFYING_USER_FIELDS = ['firstName', 'lastName', 'email', 'kcId'] as const;

function isUserLike(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    IDENTIFYING_USER_FIELDS.some((field) => field in value)
  );
}

function redactUser(
  user: Record<string, unknown>,
  viewer: FullUser
): Record<string, unknown> {
  // Never redact the viewer's own record, wherever it shows up - that's not a privacy leak,
  // it's just them.
  if (user['id'] === viewer.id) return user;

  const redacted = { ...user };
  for (const field of IDENTIFYING_USER_FIELDS) delete redacted[field];
  return redacted;
}

function walk(value: unknown, viewer: FullUser): unknown {
  if (Array.isArray(value)) return value.map((v) => walk(v, viewer));
  if (value instanceof Date) return value;
  if (typeof value !== 'object' || value === null) return value;

  const result: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (USER_RELATION_KEYS.has(key)) {
      if (Array.isArray(v)) {
        result[key] = v.map((u) => (isUserLike(u) ? redactUser(u, viewer) : walk(u, viewer)));
        continue;
      }
      if (isUserLike(v)) {
        result[key] = redactUser(v, viewer);
        continue;
      }
    }
    result[key] = walk(v, viewer);
  }
  return result;
}

/**
 * Strips identifying fields (see IDENTIFYING_USER_FIELDS) off every embedded User anywhere in
 * `body`, for Controller/OrgController - the only fields a response then still carries for those
 * users are id/organisation/subOrganisations/jobTitle/role, matching the AnonUser type. No-op for
 * every other role, and for whoever `viewer` themself is (their own record is never redacted).
 */
export function anonymizeUsersFor<T>(body: T, viewer: FullUser | undefined): T {
  if (!viewer || !ANONYMIZED_ROLES.includes(viewer.role)) return body;
  return walk(body, viewer) as T;
}
