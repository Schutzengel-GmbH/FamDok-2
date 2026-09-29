import { Case } from '../../../../shared/generated/prisma/client';
import { FullCase, FullUser } from '../../../../shared/types';
import { Role } from '../../../../shared/generated/prisma/enums';

type Primitive = string | number | symbol | bigint | boolean | null | undefined;

export function sortByNumProperty<
  T extends Record<K, N>,
  K extends keyof T,
  N extends number,
>(key: K) {
  return (a: T, b: T) => a[key] - b[key];
}

export function sortByStringProperty<
  T extends Record<K, N>,
  K extends keyof T,
  N extends string,
>(key: K) {
  return (a: T, b: T) => a[key].localeCompare(b[key]);
}

export function sortCasesByFamilyName(a: FullCase, b: FullCase) {
  if (!a.family?.name || !b.family?.name) return 0;
  return a.family?.name.localeCompare(b.family?.name);
}

/** Whether `user` could actually save changes to `c` - matches the backend's canEditCase
 * (Admin, or one of the case's responsibleUsers). Coordinators viewing another org member's
 * case only get a read-only view. */
export function userCanEditCase(
  user: FullUser | undefined,
  c: FullCase | undefined,
): boolean {
  if (!user || !c) return false;
  if (user.role === Role.Admin) return true;
  return c.responsibleUsers.some((ru) => ru.id === user.id);
}

export function isEmptyObject(test: unknown) {
  if (typeof test !== 'object') return false;
  for (const prop in test) {
    if (Object.hasOwn(test, prop)) return false;
  }
  return true;
}

export function unique<T extends Primitive>(
  value: T,
  index: number,
  array: T[],
) {
  return array.indexOf(value) === index;
}
