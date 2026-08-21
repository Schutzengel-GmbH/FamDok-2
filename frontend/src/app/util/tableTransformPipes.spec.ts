import {
  caseIdentifierPipe,
  countChildrenPipe,
  datePipe,
  familyNamePipe,
  userArrayPipe,
  userPipe,
  userWithOrgPipe,
} from './tableTransformPipes';

describe('tableTransformPipes', () => {
  describe('datePipe', () => {
    it('formats a date using the locale date string', () => {
      const date = new Date('2026-03-15');

      expect(datePipe.transform(date)).toBe(date.toLocaleDateString());
    });
  });

  describe('userPipe', () => {
    it('renders first and last name when present', () => {
      const user = { firstName: 'Anna', lastName: 'Muster', email: 'a@b.de' } as any;

      expect(userPipe.transform(user)).toBe('Anna Muster');
    });

    it('falls back to the email when no name is set', () => {
      const user = { firstName: null, lastName: null, email: 'a@b.de' } as any;

      expect(userPipe.transform(user)).toBe('a@b.de');
    });

    it('renders an anonymized user as "Org - SubOrg"', () => {
      const anonUser = {
        id: 'u1',
        organisation: { name: 'Org 1' },
        subOrganisations: [{ name: 'Sub 1' }],
      } as any;

      expect(userPipe.transform(anonUser)).toBe('Org 1 - Sub 1');
    });

    it('renders just the organisation when an anonymized user has no sub-organisation', () => {
      const anonUser = {
        id: 'u1',
        organisation: { name: 'Org 1' },
        subOrganisations: [],
      } as any;

      expect(userPipe.transform(anonUser)).toBe('Org 1');
    });
  });

  describe('userWithOrgPipe', () => {
    it('appends the organisation name in parentheses', () => {
      const user = {
        firstName: 'Anna',
        lastName: 'Muster',
        email: 'a@b.de',
        organisation: { name: 'Org 1' },
        subOrganisations: [],
      } as any;

      expect(userWithOrgPipe.transform(user)).toBe('Anna Muster (Org 1)');
    });

    it('appends sub-organisations alongside the organisation', () => {
      const user = {
        firstName: 'Anna',
        lastName: 'Muster',
        email: 'a@b.de',
        organisation: { name: 'Org 1' },
        subOrganisations: [{ name: 'Sub 1' }, { name: 'Sub 2' }],
      } as any;

      expect(userWithOrgPipe.transform(user)).toBe(
        'Anna Muster (Org 1 – Sub 1, Sub 2)',
      );
    });

    it('renders just the name when there is no organisation', () => {
      const user = {
        firstName: 'Anna',
        lastName: 'Muster',
        email: 'a@b.de',
        organisation: null,
        subOrganisations: [],
      } as any;

      expect(userWithOrgPipe.transform(user)).toBe('Anna Muster');
    });

    it('returns an empty string for a missing user', () => {
      expect(userWithOrgPipe.transform(null)).toBe('');
      expect(userWithOrgPipe.transform(undefined)).toBe('');
    });

    it('renders an anonymized user as "Org - SubOrg" without a name or parentheses', () => {
      const anonUser = {
        id: 'u1',
        organisation: { name: 'Org 1' },
        subOrganisations: [{ name: 'Sub 2' }],
      } as any;

      expect(userWithOrgPipe.transform(anonUser)).toBe('Org 1 - Sub 2');
    });
  });

  describe('familyNamePipe', () => {
    it('prefixes the family name', () => {
      expect(familyNamePipe.transform({ name: 'Muster' } as any)).toBe('Familie Muster');
    });
  });

  describe('userArrayPipe', () => {
    it('joins user names with a comma', () => {
      const users = [
        { firstName: 'Anna', lastName: 'Muster' },
        { firstName: 'Max', lastName: 'Muster' },
      ] as any;

      expect(userArrayPipe.transform(users)).toBe('Anna Muster, Max Muster');
    });

    it('returns an empty string for an empty array', () => {
      expect(userArrayPipe.transform([])).toBe('');
    });

    it('renders anonymized users as their org label alongside named users', () => {
      const users = [
        { firstName: 'Anna', lastName: 'Muster' },
        { id: 'u2', organisation: { name: 'Org 1' }, subOrganisations: [] },
      ] as any;

      expect(userArrayPipe.transform(users)).toBe('Anna Muster, Org 1');
    });
  });

  describe('countChildrenPipe', () => {
    it('counts the children', () => {
      expect(countChildrenPipe.transform([{}, {}] as any)).toBe(2);
    });
  });

  describe('caseIdentifierPipe', () => {
    it('builds an identifier from city and start date', () => {
      const c = { city: 'Berlin', startedAt: new Date('2026-03-05') } as any;

      expect(caseIdentifierPipe.transform(c)).toBe('BER20260306');
    });

    it('falls back to UNB when no city is set', () => {
      const c = { city: null, startedAt: new Date('2026-03-05') } as any;

      expect(caseIdentifierPipe.transform(c)).toBe('UNB20260306');
    });
  });
});
