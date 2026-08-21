import { CASEFORM_DEFAULT_INCLUDE } from '../../shared/consts';
import { FullUser } from '../../shared/types';
import { prisma } from '../db';
import { Prisma, Role } from '../../shared/generated/prisma/client';
import { ForbiddenError, NotFoundError } from '../util/authUtils';
import {
  canCreateCaseForm,
  canEditCaseForm,
  caseFormWhereRestrictions,
} from './authFns/CaseFormDefinitionAuthFns';

export class CaseFormController {
  static async getAll(user: FullUser) {
    return prisma.caseForm.findMany({
      where: { AND: caseFormWhereRestrictions(user) },
      orderBy: { name: 'asc' },
      include: CASEFORM_DEFAULT_INCLUDE,
    });
  }

  static async getWhere(user: FullUser, where?: Prisma.CaseFormWhereInput) {
    return prisma.caseForm.findMany({
      where: { AND: [{ ...where }, ...caseFormWhereRestrictions(user)] },
      orderBy: { name: 'asc' },
      include: CASEFORM_DEFAULT_INCLUDE,
    });
  }

  static async get(user: FullUser, id: string) {
    const form = await prisma.caseForm.findFirst({
      where: { id, AND: caseFormWhereRestrictions(user) },
      include: CASEFORM_DEFAULT_INCLUDE,
    });
    if (!form) throw new NotFoundError();
    return form;
  }

  static create(user: FullUser, data: Prisma.CaseFormCreateInput) {
    if (!canCreateCaseForm(user, data))
      throw new ForbiddenError("User can't create new Forms");

    return prisma.caseForm.create({
      data,
      include: CASEFORM_DEFAULT_INCLUDE,
    });
  }

  static async update(
    user: FullUser,
    id: string,
    data: Prisma.CaseFormUpdateInput
  ) {
    const existing = await prisma.caseForm.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError();
    if (!canEditCaseForm(user, existing))
      throw new ForbiddenError("User can't update Forms");

    // OrgController can't move a form to another org or make it global - only Admin/Controller
    // (who bypass this check above) may change organisationId.
    if (user.role === Role.OrgController) delete data.organisation;

    return prisma.caseForm.update({
      where: { id },
      data,
      include: CASEFORM_DEFAULT_INCLUDE,
    });
  }

  static async delete(user: FullUser, id: string) {
    const existing = await prisma.caseForm.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError();
    if (!canEditCaseForm(user, existing))
      throw new ForbiddenError("User can't delete Forms");

    return prisma.caseForm.delete({
      where: { id },
      include: CASEFORM_DEFAULT_INCLUDE,
    });
  }
}
