import {
  ORGANISATION_DEFAULT_INCLUDE,
  SUBORGANISATION_DEFAULT_INCLUDE,
} from '../../shared/consts';
import { FullUser } from '../../shared/types';
import { prisma } from '../db';
import { Prisma } from '../../shared/generated/prisma/client';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../util/authUtils';
import {
  canAccessAllOrgs,
  canAccessOrg,
  canEditOrgs,
  canEditSubOrgs,
} from './authFns/OrgAuthFns';

export class OrgController {
  static async getAllOrgs(user: FullUser) {
    if (!canAccessAllOrgs(user)) throw new ForbiddenError();

    return prisma.organisation.findMany({
      include: ORGANISATION_DEFAULT_INCLUDE,
    });
  }

  static async getOrg(user: FullUser, id: string) {
    const org = await prisma.organisation.findUnique({
      where: { id },
      include: ORGANISATION_DEFAULT_INCLUDE,
    });

    if (!org) throw new NotFoundError();
    if (!canAccessOrg(user, org)) throw new ForbiddenError();

    return org;
  }

  static async createOrg(user: FullUser, data: Prisma.OrganisationCreateInput) {
    if (!canEditOrgs(user)) throw new ForbiddenError();

    return prisma.organisation.create({
      data,
      include: ORGANISATION_DEFAULT_INCLUDE,
    });
  }

  static async updateOrg(
    user: FullUser,
    id: string,
    data: Prisma.OrganisationUpdateInput
  ) {
    if (!canEditOrgs(user)) throw new ForbiddenError();

    return prisma.organisation.update({
      where: { id },
      data,
      include: ORGANISATION_DEFAULT_INCLUDE,
    });
  }

  static async deleteOrg(user: FullUser, id: string) {
    if (!canEditOrgs(user)) throw new ForbiddenError();

    return prisma.organisation.delete({
      where: { id },
      include: ORGANISATION_DEFAULT_INCLUDE,
    });
  }

  static async getAllSubOrgs(user: FullUser, orgId: string) {
    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      include: ORGANISATION_DEFAULT_INCLUDE,
    });

    if (!org) throw new NotFoundError();
    if (!canAccessOrg(user, org)) throw new ForbiddenError();

    return org.subOrganisations;
  }

  static async getSubOrg(user: FullUser, id: string) {
    const subOrg = await prisma.subOrganisation.findUnique({
      where: { id },
      include: SUBORGANISATION_DEFAULT_INCLUDE,
    });

    if (!subOrg) throw new NotFoundError();
    if (
      !canAccessAllOrgs(user) &&
      user.organisationId !== subOrg.organisationId
    )
      throw new ForbiddenError();

    return subOrg;
  }

  static async createSubOrg(
    user: FullUser,
    data: Prisma.SubOrganisationCreateInput
  ) {
    if (!data.organisation.connect?.id)
      throw new BadRequestError('no org id provided');

    if (!canEditSubOrgs(user, data.organisation.connect.id))
      throw new ForbiddenError();

    return prisma.subOrganisation.create({
      data,
      include: SUBORGANISATION_DEFAULT_INCLUDE,
    });
  }

  static async updateSubOrg(
    user: FullUser,
    id: string,
    data: Prisma.SubOrganisationUpdateInput
  ) {
    return prisma.$transaction(async (tx) => {
      const subOrg = await tx.subOrganisation.findUnique({ where: { id } });

      if (!subOrg) throw new NotFoundError();

      if (!canEditSubOrgs(user, subOrg.organisationId))
        throw new ForbiddenError();

      return tx.subOrganisation.update({
        where: { id },
        data,
        include: SUBORGANISATION_DEFAULT_INCLUDE,
      });
    });
  }

  static async deleteSubOrg(user: FullUser, id: string) {
    return prisma.$transaction(async (tx) => {
      const subOrg = await tx.subOrganisation.findUnique({ where: { id } });

      if (!subOrg) throw new NotFoundError();

      if (!canEditSubOrgs(user, subOrg.organisationId))
        throw new ForbiddenError();

      return prisma.subOrganisation.delete({
        where: { id },
        include: SUBORGANISATION_DEFAULT_INCLUDE,
      });
    });
  }
}
