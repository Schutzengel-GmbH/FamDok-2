import { anonymizeUsersFor } from '../anonymizeUsers';
import { buildUser } from '../../testUtils/fixtures';
import { Role } from '../../../shared/generated/prisma/client';

describe('anonymizeUsersFor', () => {
  const identifyingFields = ['firstName', 'lastName', 'email', 'kcId'] as const;

  it('is a no-op for non-anonymized roles', () => {
    const viewer = buildUser({ role: Role.Admin });
    const body = { createdBy: buildUser({ firstName: 'Anna' }) };

    expect(anonymizeUsersFor(body, viewer)).toEqual(body);
  });

  it('is a no-op when there is no viewer', () => {
    const body = { createdBy: buildUser({ firstName: 'Anna' }) };

    expect(anonymizeUsersFor(body, undefined)).toEqual(body);
  });

  it.each([Role.Controller, Role.OrgController])(
    'strips identifying fields off a nested createdBy for %s',
    (role) => {
      const viewer = buildUser({ role, id: 'viewer-1' });
      const creator = buildUser({ id: 'other-1', firstName: 'Anna', lastName: 'Muster' });
      const body = { id: 'doc-1', createdBy: creator };

      const result = anonymizeUsersFor(body, viewer) as any;

      for (const field of identifyingFields) expect(result.createdBy[field]).toBeUndefined();
      expect(result.createdBy.id).toBe('other-1');
      expect(result.id).toBe('doc-1');
    },
  );

  it('strips fields off every entry of a responsibleUsers array, arbitrarily nested', () => {
    const viewer = buildUser({ role: Role.Controller, id: 'viewer-1' });
    const ru1 = buildUser({ id: 'ru-1', firstName: 'A' });
    const ru2 = buildUser({ id: 'ru-2', firstName: 'B' });
    const body = { case: { responsibleUsers: [ru1, ru2] } };

    const result = anonymizeUsersFor(body, viewer) as any;

    expect(result.case.responsibleUsers[0].firstName).toBeUndefined();
    expect(result.case.responsibleUsers[1].firstName).toBeUndefined();
    expect(result.case.responsibleUsers[0].id).toBe('ru-1');
  });

  it('strips uploadedBy the same way', () => {
    const viewer = buildUser({ role: Role.OrgController, id: 'viewer-1' });
    const body = { uploadedBy: buildUser({ id: 'other-1', email: 'a@b.de' }) };

    const result = anonymizeUsersFor(body, viewer) as any;

    expect(result.uploadedBy.email).toBeUndefined();
  });

  it('keeps organisation, subOrganisations, jobTitle and role intact', () => {
    const viewer = buildUser({ role: Role.Controller, id: 'viewer-1' });
    const creator = buildUser({
      id: 'other-1',
      jobTitle: 'Sozialarbeiter',
      role: Role.User,
      organisation: { id: 'org-1', name: 'Org 1' },
      subOrganisations: [{ id: 'sub-1', name: 'Sub 1' }],
    });
    const body = { createdBy: creator };

    const result = anonymizeUsersFor(body, viewer) as any;

    expect(result.createdBy.jobTitle).toBe('Sozialarbeiter');
    expect(result.createdBy.role).toBe(Role.User);
    expect(result.createdBy.organisation).toEqual({ id: 'org-1', name: 'Org 1' });
    expect(result.createdBy.subOrganisations).toEqual([{ id: 'sub-1', name: 'Sub 1' }]);
  });

  it("never redacts the viewer's own record, wherever it appears", () => {
    const viewer = buildUser({ role: Role.Controller, id: 'viewer-1', firstName: 'Me' });
    const body = { createdBy: buildUser({ id: 'viewer-1', firstName: 'Me' }) };

    const result = anonymizeUsersFor(body, viewer) as any;

    expect(result.createdBy.firstName).toBe('Me');
  });

  it('leaves Date values, arrays of non-user objects, and primitives untouched', () => {
    const viewer = buildUser({ role: Role.Controller, id: 'viewer-1' });
    const date = new Date('2026-01-01');
    const body = {
      date,
      tags: ['a', 'b'],
      count: 3,
      note: null,
    };

    expect(anonymizeUsersFor(body, viewer)).toEqual(body);
  });

  it('recurses through nested case/documentation structures to find embedded users', () => {
    const viewer = buildUser({ role: Role.Controller, id: 'viewer-1' });
    const body = [
      {
        id: 'doc-1',
        createdBy: buildUser({ id: 'a', firstName: 'A' }),
        case: {
          responsibleUsers: [buildUser({ id: 'b', firstName: 'B' })],
          createdBy: buildUser({ id: 'c', firstName: 'C' }),
        },
      },
    ];

    const result = anonymizeUsersFor(body, viewer) as any;

    expect(result[0].createdBy.firstName).toBeUndefined();
    expect(result[0].case.responsibleUsers[0].firstName).toBeUndefined();
    expect(result[0].case.createdBy.firstName).toBeUndefined();
  });
});
