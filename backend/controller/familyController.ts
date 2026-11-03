import { FAMILY_DEFAULT_INCLUDE } from '../../shared/consts';
import { FullUser } from '../../shared/types';
import { prisma } from '../db';
import { Prisma } from '../../shared/generated/prisma/client';
import { ForbiddenError, NotFoundError } from '../util/authUtils';
import {
  canSeeAllFamilies,
  canSeeFamilies,
  canSeeFamily,
  canEditFamily,
} from './authFns/FamilyAuthFn';
import { ChildHealthDataRequest, FamilyUpdateRequest } from '../../shared/api';

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

  static async update(user: FullUser, id: string, data: FamilyUpdateRequest) {
    const family = await prisma.family.findUniqueOrThrow({
      where: { id },
      include: FAMILY_DEFAULT_INCLUDE,
    });

    if (!family) throw new NotFoundError();
    if (!canEditFamily(user, family)) throw new ForbiddenError();

    const { children, caregivers, case: caseFields, adress, ...fields } = data;

    if (adress?.city || adress?.plz) {
      await prisma.case.updateMany({
        where: { familyId: id },
        data: { city: adress.city, plz: adress.plz },
      });
    }

    return prisma.family.update({
      where: { id },
      data: {
        ...fields,
        adress: adress as PrismaJson.Address | undefined,
        children: children && {
          deleteMany: {},
          createMany: {
            data: children as Prisma.ChildCreateManyFamilyInput[],
          },
        },
        caregiver: caregivers && {
          deleteMany: {},
          createMany: { data: caregivers },
        },
        case: caseFields && { update: caseFields },
      },
      include: FAMILY_DEFAULT_INCLUDE,
    });
  }

  static async updateChildHealthData(
    user: FullUser,
    id: string,
    childId: string,
    { healthData }: ChildHealthDataRequest
  ) {
    const family = await prisma.family.findUniqueOrThrow({
      where: { id },
      include: FAMILY_DEFAULT_INCLUDE,
    });

    if (!canEditFamily(user, family)) throw new ForbiddenError();

    return prisma.family.update({
      where: { id },
      data: {
        children: {
          update: {
            where: { id: childId },
            data: { healthData: healthData as PrismaJson.HealthDataPointChild[] },
          },
        },
      },
      include: FAMILY_DEFAULT_INCLUDE,
    });
  }

  static async delete(user: FullUser, id: string) {
    const family = await prisma.family.findUniqueOrThrow({
      where: { id },
      include: FAMILY_DEFAULT_INCLUDE,
    });

    if (!family) throw new NotFoundError();
    if (!canEditFamily(user, family)) throw new ForbiddenError();

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
