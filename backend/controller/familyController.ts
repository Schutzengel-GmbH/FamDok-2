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
import {
  assertBlobWrite,
  assertClientId,
  assertFieldWrite,
  encryptionPolicyFor,
} from '../util/encryptionPolicy';
import { BadRequestError } from '../util/authUtils';
import { clearedBlobFields } from '../../shared/utils/encryptedModels';

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

  /**
   * Updates a family with its children and caregivers, and the case fields edited alongside.
   * In encrypted orgs every personal field arrives inside the blobs (and `case.city`/`plz` as
   * the plaintext statistics copy); writing a blob also clears plaintext left over from before
   * the migration.
   */
  static async update(user: FullUser, id: string, data: FamilyUpdateRequest) {
    const family = await prisma.family.findUniqueOrThrow({
      where: { id },
      include: FAMILY_DEFAULT_INCLUDE,
    });

    if (!family) throw new NotFoundError();
    if (!canEditFamily(user, family)) throw new ForbiddenError();

    const policy = await encryptionPolicyFor(family.organisationId);
    const { children, caregivers, case: caseFields, adress, ...fields } = data;
    assertBlobWrite(policy, 'Family', { ...fields, adress }, false);
    for (const child of children ?? []) {
      assertClientId(policy, child.id, 'Child');
      assertBlobWrite(policy, 'Child', child, true);
    }
    for (const caregiver of caregivers ?? []) {
      assertClientId(policy, caregiver.id, 'Caregiver');
      assertBlobWrite(policy, 'Caregiver', caregiver, true);
    }
    if (caseFields) assertFieldWrite(policy, 'Case', caseFields);

    if (!policy.active && (adress?.city || adress?.plz)) {
      await prisma.case.updateMany({
        where: { familyId: id },
        data: { city: adress.city, plz: adress.plz },
      });
    }

    return prisma.family.update({
      where: { id },
      data: {
        ...(fields.encrypted ? clearedBlobFields('Family') : {}),
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

  /**
   * Replaces a child's health data. In encrypted orgs it lives in the child's blob, so the whole
   * re-encrypted blob replaces the old one.
   */
  static async updateChildHealthData(
    user: FullUser,
    id: string,
    childId: string,
    { healthData, encrypted }: ChildHealthDataRequest
  ) {
    const family = await prisma.family.findUniqueOrThrow({
      where: { id },
      include: FAMILY_DEFAULT_INCLUDE,
    });

    if (!canEditFamily(user, family)) throw new ForbiddenError();

    const policy = await encryptionPolicyFor(family.organisationId);
    assertBlobWrite(policy, 'Child', { healthData, encrypted }, policy.active);
    if (!policy.active && !healthData)
      throw new BadRequestError('healthData is missing');

    return prisma.family.update({
      where: { id },
      data: {
        children: {
          update: {
            where: { id: childId },
            data: policy.active
              ? { ...clearedBlobFields('Child'), encrypted }
              : { healthData: healthData as PrismaJson.HealthDataPointChild[] },
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
