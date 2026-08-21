jest.mock('../../db', () => ({ prisma: require('../../testUtils/prismaMock').createPrismaMock() }));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import { buildFamily, buildUser } from '../../testUtils/fixtures';
import { FamilyController } from '../familyController';
import { ForbiddenError, NotFoundError } from '../../util/authUtils';
import { Role } from '../../../shared/generated/prisma/client';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

function familyVisibleTo(userId: string, overrides: Record<string, any> = {}) {
  return buildFamily({
    case: { responsibleUsers: [{ id: userId }] },
    ...overrides,
  });
}

describe('FamilyController', () => {
  describe('getAll', () => {
    it('returns all families for Admin', async () => {
      const admin = buildUser({ role: Role.Admin });
      const families = [buildFamily()];
      prismaMock.family.findMany.mockResolvedValue(families);

      const result = await FamilyController.getAll(admin);

      expect(result).toBe(families);
    });

    it('throws ForbiddenError for non-admins', async () => {
      const user = buildUser({ role: Role.OrgController });

      await expect(FamilyController.getAll(user)).rejects.toThrow(ForbiddenError);
      expect(prismaMock.family.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getWhere', () => {
    it('returns families the user can see', async () => {
      const user = buildUser({ role: Role.User });
      const families = [familyVisibleTo(user.id)];
      prismaMock.family.findMany.mockResolvedValue(families);

      const result = await FamilyController.getWhere(user, {} as any);

      expect(result).toBe(families);
    });

    it('throws ForbiddenError when the user cannot see all matched families', async () => {
      const user = buildUser({ role: Role.User });
      const families = [familyVisibleTo('someone-else')];
      prismaMock.family.findMany.mockResolvedValue(families);

      await expect(FamilyController.getWhere(user, {} as any)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getChildren / getChild', () => {
    it('returns the children of a visible family', async () => {
      const user = buildUser({ role: Role.Admin });
      const children = [{ id: 'child-1', name: 'Kid' }];
      const family = familyVisibleTo(user.id, { children });
      prismaMock.family.findUnique.mockResolvedValue(family);

      const result = await FamilyController.getChildren(user, family.id);

      expect(result).toBe(children);
    });

    it('throws NotFoundError when the family is missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.family.findUnique.mockResolvedValue(null);

      await expect(FamilyController.getChildren(user, 'missing')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the user cannot see the family', async () => {
      const user = buildUser({ role: Role.User });
      const family = familyVisibleTo('someone-else');
      prismaMock.family.findUnique.mockResolvedValue(family);

      await expect(FamilyController.getChildren(user, family.id)).rejects.toThrow(ForbiddenError);
    });

    it('returns a single child by id', async () => {
      const user = buildUser({ role: Role.Admin });
      const child = { id: 'child-1', name: 'Kid' };
      const family = familyVisibleTo(user.id, { children: [child] });
      prismaMock.family.findFirst.mockResolvedValue(family);

      const result = await FamilyController.getChild(user, 'child-1');

      expect(result).toBe(child);
    });

    it('throws NotFoundError when no family has that child', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.family.findFirst.mockResolvedValue(null);

      await expect(FamilyController.getChild(user, 'missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getCaregivers / getCaregiver', () => {
    it('returns caregivers of a visible family', async () => {
      const user = buildUser({ role: Role.Admin });
      const caregiver = [{ id: 'cg-1', name: 'Parent' }];
      const family = familyVisibleTo(user.id, { caregiver });
      prismaMock.family.findUnique.mockResolvedValue(family);

      const result = await FamilyController.getCaregivers(user, family.id);

      expect(result).toBe(caregiver);
    });

    it('throws NotFoundError when the family is missing', async () => {
      const user = buildUser({ role: Role.Admin });
      prismaMock.family.findUnique.mockResolvedValue(null);

      await expect(FamilyController.getCaregivers(user, 'missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getStats', () => {
    it('maps families to anonymised stats entries', async () => {
      const families = [
        buildFamily({ caregiver: [{ id: 'cg-1' }], children: [{ id: 'c-1' }, { id: 'c-2' }] }),
      ];
      prismaMock.family.findMany.mockResolvedValue(families);

      const result = await FamilyController.getStats();

      expect(result).toEqual([
        {
          number: 0,
          caregiver: [{ number: 0 }],
          children: [{ number: 0 }, { number: 1 }],
        },
      ]);
    });
  });

  describe('get', () => {
    it('returns a visible family', async () => {
      const user = buildUser({ role: Role.Admin });
      const family = familyVisibleTo(user.id);
      prismaMock.family.findUniqueOrThrow.mockResolvedValue(family);

      const result = await FamilyController.get(user, family.id);

      expect(result).toBe(family);
    });

    it('throws ForbiddenError when the user cannot see the family', async () => {
      const user = buildUser({ role: Role.User });
      const family = familyVisibleTo('someone-else');
      prismaMock.family.findUniqueOrThrow.mockResolvedValue(family);

      await expect(FamilyController.get(user, family.id)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('create', () => {
    it('creates a family when the org matches the user', async () => {
      const user = buildUser({ role: Role.User, organisationId: 'org-1' });
      const created = buildFamily();
      prismaMock.family.create.mockResolvedValue(created);

      const result = await FamilyController.create(user, {
        organisation: { connect: { id: 'org-1' } },
      } as any);

      expect(result).toBe(created);
    });

    it('throws ForbiddenError when the org does not match', () => {
      const user = buildUser({ role: Role.User, organisationId: 'org-1' });

      expect(() =>
        FamilyController.create(user, { organisation: { connect: { id: 'org-2' } } } as any)
      ).toThrow(ForbiddenError);
      expect(prismaMock.family.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates the family and syncs case city/plz when adress changes', async () => {
      const user = buildUser({ role: Role.Admin });
      const family = familyVisibleTo(user.id);
      prismaMock.family.findUniqueOrThrow.mockResolvedValue(family);
      const updated = { ...family };
      prismaMock.family.update.mockResolvedValue(updated);

      const result = await FamilyController.update(user, family.id, {
        adress: { city: 'Berlin', plz: '10115' },
      } as any);

      expect(result).toBe(updated);
      expect(prismaMock.case.updateMany).toHaveBeenCalledWith({
        where: { familyId: family.id },
        data: { city: 'Berlin', plz: '10115' },
      });
    });

    it('updates the family without touching cases when adress is omitted', async () => {
      const user = buildUser({ role: Role.Admin });
      const family = familyVisibleTo(user.id);
      prismaMock.family.findUniqueOrThrow.mockResolvedValue(family);
      const updated = { ...family, name: 'New name' };
      prismaMock.family.update.mockResolvedValue(updated);

      const result = await FamilyController.update(user, family.id, { name: 'New name' } as any);

      expect(result).toBe(updated);
      expect(prismaMock.case.updateMany).not.toHaveBeenCalled();
    });

    it('throws ForbiddenError when the user cannot see the family', async () => {
      const user = buildUser({ role: Role.User });
      const family = familyVisibleTo('someone-else');
      prismaMock.family.findUniqueOrThrow.mockResolvedValue(family);

      await expect(
        FamilyController.update(user, family.id, { name: 'New name' } as any)
      ).rejects.toThrow(ForbiddenError);
      expect(prismaMock.family.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes a visible family', async () => {
      const user = buildUser({ role: Role.Admin });
      const family = familyVisibleTo(user.id);
      prismaMock.family.findUniqueOrThrow.mockResolvedValue(family);
      prismaMock.family.delete.mockResolvedValue(family);

      const result = await FamilyController.delete(user, family.id);

      expect(result).toBe(family);
    });

    it('throws ForbiddenError when the user cannot see the family', async () => {
      const user = buildUser({ role: Role.User });
      const family = familyVisibleTo('someone-else');
      prismaMock.family.findUniqueOrThrow.mockResolvedValue(family);

      await expect(FamilyController.delete(user, family.id)).rejects.toThrow(ForbiddenError);
      expect(prismaMock.family.delete).not.toHaveBeenCalled();
    });
  });
});
