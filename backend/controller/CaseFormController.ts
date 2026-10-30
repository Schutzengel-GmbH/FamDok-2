import { CASEFORM_DEFAULT_INCLUDE } from '../../shared/consts';
import { FullUser } from '../../shared/types';
import { prisma } from '../db';
import { Role } from '../../shared/generated/prisma/client';
import { ForbiddenError, NotFoundError } from '../util/authUtils';
import {
  canCreateCaseForm,
  canEditCaseForm,
  caseFormWhereRestrictions,
} from './authFns/CaseFormDefinitionAuthFns';
import {
  CaseFormCreateRequest,
  CaseFormListQuery,
  CaseFormUpdateRequest,
} from '../../shared/api';
import { questionWrites } from '../util/formWrites';

export class CaseFormController {
  static async getAll(user: FullUser) {
    return prisma.caseForm.findMany({
      where: { AND: caseFormWhereRestrictions(user) },
      orderBy: { name: 'asc' },
      include: CASEFORM_DEFAULT_INCLUDE,
    });
  }

  static async getWhere(user: FullUser, where?: CaseFormListQuery['where']) {
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

  static create(user: FullUser, data: CaseFormCreateRequest) {
    if (!canCreateCaseForm(user))
      throw new ForbiddenError("User can't create new Forms");

    const { questions, ...fields } = data;

    return prisma.caseForm.create({
      data: {
        ...fields,
        // Admin/Controller create global forms, OrgController forms of their own organisation
        organisationId:
          user.role === Role.OrgController ? user.organisationId : null,
        questions: { createMany: { data: questions } },
      },
      include: CASEFORM_DEFAULT_INCLUDE,
    });
  }

  static async update(user: FullUser, id: string, data: CaseFormUpdateRequest) {
    const existing = await prisma.caseForm.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError();
    if (!canEditCaseForm(user, existing))
      throw new ForbiddenError("User can't update Forms");

    const { questions, deletedQuestionIds, ...fields } = data;

    return prisma.caseForm.update({
      where: { id },
      data: {
        ...fields,
        questions: questionWrites({ questions, deletedQuestionIds }),
      },
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
