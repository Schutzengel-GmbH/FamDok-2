import { PipeTransform } from '@angular/core';
import {
  AnonUser,
  FullCase,
  FullFamily,
  FullUser,
} from '../../../../shared/types';
import {
  ChildModel as Child,
  UserModel as User,
} from '../../../../shared/generated/prisma/models';

export const datePipe: PipeTransform = {
  transform(date: Date | string) {
    return new Date(date).toLocaleDateString();
  },
};

/** True for a user the backend anonymized (Controller/OrgController viewer) - it carries none of
 * firstName/lastName/email, only organisation/subOrganisations/jobTitle/role/id. Requiring all
 * three absent (rather than just one) avoids misfiring on partial user objects that happen to
 * omit a single field for unrelated reasons.
 *
 * Deliberately not a `user is AnonUser` type predicate: AnonUser is an Omit of FullUser, so
 * FullUser is structurally assignable to it too, which would make TS collapse the non-anonymized
 * branch to `never` after narrowing instead of leaving it as FullUser. */
function isAnonUser(user: unknown): boolean {
  return (
    typeof user === 'object' &&
    user !== null &&
    !('firstName' in user) &&
    !('lastName' in user) &&
    !('email' in user)
  );
}

/** Renders an anonymized user as "Org1 - SubOrg2" - the only thing left to identify them by. */
function anonUserLabel(user: {
  organisation?: { name: string } | null;
  subOrganisations?: { name: string }[];
}): string {
  const subOrgNames = user.subOrganisations?.map((so) => so.name).join(', ');
  return [user.organisation?.name, subOrgNames].filter(Boolean).join(' - ');
}

export const userPipe: PipeTransform = {
  transform(user: User | AnonUser | FullUser) {
    if (isAnonUser(user)) return anonUserLabel(user as AnonUser);
    const named = user as User;
    const name = [named.firstName, named.lastName].filter(Boolean).join(' ');
    return name || named.email;
  },
};

/** Like userPipe, but appends the user's organisation and (if any) sub-organisations - used
 * for "Erstellt von" columns, where knowing who created a row is more useful alongside which
 * org/suborg they belong to. For an anonymized user there is no name to append to, so this just
 * renders the same "Org1 - SubOrg2" label as userPipe. */
export const userWithOrgPipe: PipeTransform = {
  transform(user: FullUser | AnonUser | null | undefined) {
    if (!user) return '';
    if (isAnonUser(user)) return anonUserLabel(user as AnonUser);
    const fullUser = user as FullUser;
    const name = userPipe.transform(fullUser);
    const subOrgNames = fullUser.subOrganisations
      ?.map((so) => so.name)
      .join(', ');
    const orgLabel = [fullUser.organisation?.name, subOrgNames]
      .filter(Boolean)
      .join(' – ');
    return orgLabel ? `${name} (${orgLabel})` : name;
  },
};

export const familyNamePipe: PipeTransform = {
  transform(family: FullFamily | null | undefined) {
    if (!family) return 'Familie (Daten gelöscht)';
    return `Familie ${family.name}`;
  },
};

export const userArrayPipe: PipeTransform = {
  transform(users: (FullUser | AnonUser)[]) {
    return users.reduce(
      (prev, cur, i) =>
        prev + `${i === 0 ? '' : ', '}${userPipe.transform(cur)}`,
      '',
    );
  },
};

export const countChildrenPipe: PipeTransform = {
  transform(children: Child[] | undefined) {
    return children?.length ?? 0;
  },
};

export const caseIdentifierPipe: PipeTransform = {
  transform(c: FullCase) {
    const city = c.city?.substring(0, 3).toUpperCase() || 'UNB';
    const year = new Date(c.startedAt).getFullYear().toString();
    const month = (new Date(c.startedAt).getMonth() + 1)
      .toString()
      .padStart(2, '0');
    const day = (new Date(c.startedAt).getDate() + 1)
      .toString()
      .padStart(2, '0');
    return `${city}${year}${month}${day}`;
  },
};
