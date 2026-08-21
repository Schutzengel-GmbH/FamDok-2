import { FAMILY_DEFAULT_INCLUDE } from '../../shared/consts';
import { FullUser } from '../../shared/types';
import { prisma } from '../db';
import { Prisma } from '../../shared/generated/prisma/client';
import { ForbiddenError, NotFoundError } from '../util/authUtils';
import {
  canSeeAllFamilies,
  canSeeFamilies,
  canSeeFamily,
  canCreateFamily,
} from './authFns/FamilyAuthFn';

export class FamilyController {
  static async getAll(
    user: FullUser,
    include: Prisma.FamilyInclude = FAMILY_DEFAULT_INCLUDE
  ) {
    if (!canSeeAllFamilies(user)) throw new ForbiddenError();

    return prisma.family.findMany({
      include: include,
    });
  }

  static async getWhere(user: FullUser, where?: Prisma.FamilyWhereInput) {
    const families = await prisma.family.findMany({
      where,
      include: FAMILY_DEFAULT_INCLUDE,
    });

    if (!canSeeFamilies(user, families)) throw new ForbiddenError();

    return families;
  }

  static async getChildren(user: FullUser, familyId: string) {
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: FAMILY_DEFAULT_INCLUDE,
    });

    if (!family) throw new NotFoundError();
    if (!canSeeFamily(user, family)) throw new ForbiddenError();

    return family?.children;
  }

  static async getChild(user: FullUser, childId: string) {
    const family = await prisma.family.findFirst({
      where: { children: { some: { id: childId } } },
      include: FAMILY_DEFAULT_INCLUDE,
    });

    if (!family) throw new NotFoundError();
    if (!canSeeFamily(user, family)) throw new ForbiddenError();

    return family?.children.find((c) => c.id === childId)!;
  }

  static async getCaregivers(user: FullUser, familyId: string) {
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: FAMILY_DEFAULT_INCLUDE,
    });

    if (!family) throw new NotFoundError();
    if (!canSeeFamily(user, family)) throw new ForbiddenError();

    return family?.caregiver;
  }

  static async getCaregiver(user: FullUser, caregiverId: string) {
    const family = await prisma.family.findFirst({
      where: { children: { some: { id: caregiverId } } },
      include: FAMILY_DEFAULT_INCLUDE,
    });

    if (!family) throw new NotFoundError();
    if (!canSeeFamily(user, family)) throw new ForbiddenError();

    return family?.children.find((c) => c.id === caregiverId)!;
  }

  static async getStats(
    where?: Prisma.FamilyWhereInput,
    include: Prisma.FamilyInclude = FAMILY_DEFAULT_INCLUDE
  ) {
    const families = await prisma.family.findMany({
      where,
      include: include,
    });
    return families.map(familyStatsMapper);
  }

  static async get(user: FullUser, id: string) {
    const family = await prisma.family.findUniqueOrThrow({
      where: { id },
      include: FAMILY_DEFAULT_INCLUDE,
    });

    if (!family) throw new NotFoundError();
    if (!canSeeFamily(user, family)) throw new ForbiddenError();

    return family;
  }

  static create(user: FullUser, data: Prisma.FamilyCreateInput) {
    if (!canCreateFamily(user, data)) throw new ForbiddenError();
    return prisma.family.create({
      data,
      include: FAMILY_DEFAULT_INCLUDE,
    });
  }

  static async update(
    user: FullUser,
    id: string,
    data: Prisma.FamilyUpdateInput
  ) {
    const family = await prisma.family.findUniqueOrThrow({
      where: { id },
      include: FAMILY_DEFAULT_INCLUDE,
    });

    if (!family) throw new NotFoundError();
    if (!canSeeFamily(user, family)) throw new ForbiddenError();

    const adress = data.adress as PrismaJson.Address | undefined;
    if (adress?.city || adress?.plz) {
      const up = await prisma.case.updateMany({
        where: { familyId: id },
        data: { city: adress.city, plz: adress.plz },
      });
    }

    return prisma.family.update({
      where: { id },
      data,
      include: FAMILY_DEFAULT_INCLUDE,
    });
  }

  static async delete(user: FullUser, id: string) {
    const family = await prisma.family.findUniqueOrThrow({
      where: { id },
      include: FAMILY_DEFAULT_INCLUDE,
    });

    if (!family) throw new NotFoundError();
    if (!canSeeFamily(user, family)) throw new ForbiddenError();

    return prisma.family.delete({
      where: { id },
      include: FAMILY_DEFAULT_INCLUDE,
    });
  }
}

function familyStatsMapper(
  family: Prisma.FamilyGetPayload<{
    include: Prisma.FamilyInclude;
  }>,
  i: number
) {
  return {
    number: i,
    caregiver: family.caregiver.map((c, i) => ({ number: i })),
    children: family.children.map((c, i) => ({ number: i })),
  };
}
