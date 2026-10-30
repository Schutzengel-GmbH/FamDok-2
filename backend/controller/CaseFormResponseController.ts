import { prisma } from '../db';
import { Role } from '../../shared/generated/prisma/client';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../util/authUtils';
import {
  canCreateCaseFormResponse,
  canEditCaseFormResponse,
  canSeeCaseFormResponse,
  canSeeCaseFormResponses,
  isFamilyMember,
  visibleCaseFormResponseWhere,
} from './authFns/CaseFormResponseAuthFns';
import { caseWhereFor } from './authFns/CaseAuthFns';
import { FullUser } from '../../shared/types';
import {
  CASEFORM_DEFAULT_INCLUDE,
  CASEFORMRESPONSE_DEFAULT_INCLUDE,
} from '../../shared/consts';
import { caseFormWhereRestrictions } from './authFns/CaseFormDefinitionAuthFns';
import {
  CaseFormResponseCreateRequest,
  CaseFormResponseUpdateRequest,
  CaseFormResponseWhere,
} from '../../shared/api';
import { answerWrites, answersFor, relationWrite } from '../util/formWrites';

export class CaseFormResponseController {
  static async getAll(user: FullUser) {
    if (user.role !== Role.Admin) throw new ForbiddenError();

    return prisma.caseFormResponse.findMany({
      include: CASEFORMRESPONSE_DEFAULT_INCLUDE,
    });
  }

  static async getWhere(user: FullUser, where: CaseFormResponseWhere = {}) {
    const filter = { ...where, case: caseWhereFor(user, where.case) };
    const responses = await prisma.caseFormResponse.findMany({
      where: { AND: [filter, visibleCaseFormResponseWhere(user)] },
      include: CASEFORMRESPONSE_DEFAULT_INCLUDE,
    });
    if (!canSeeCaseFormResponses(user, responses)) throw new ForbiddenError();

    return responses;
  }

  static async get(user: FullUser, id: string) {
    const response = await prisma.caseFormResponse.findUnique({
      where: { id },
      include: CASEFORMRESPONSE_DEFAULT_INCLUDE,
    });
    if (!response) throw new NotFoundError();
    if (!canSeeCaseFormResponse(user, response)) throw new ForbiddenError();

    return response;
  }

  static async create(user: FullUser, data: CaseFormResponseCreateRequest) {
    const { caseId, caseFormId, caregiverId, childId } = data;

    if (!(await canCreateCaseFormResponse(user, data)))
      throw new ForbiddenError();

    return prisma.$transaction(async (tx) => {
      const definition = await tx.caseForm.findUnique({
        where: {
          id: caseFormId,
          AND: caseFormWhereRestrictions(user),
        },
        include: CASEFORM_DEFAULT_INCLUDE,
      });

      if (!definition)
        throw new BadRequestError(
          'case form not found (do you have all required permissions?)'
        );

      if (definition.type === 'single') {
        const count = await tx.caseFormResponse.count({
          where: {
            caseFormId,
            caseId,
          },
        });

        if (count > 0)
          throw new BadRequestError(
            'multiple entries for single type definition'
          );
      }

      return tx.caseFormResponse.create({
        data: {
          case: { connect: { id: caseId } },
          caseForm: { connect: { id: caseFormId } },
          createdBy: { connect: { id: user.id } },
          caregiver: caregiverId ? { connect: { id: caregiverId } } : undefined,
          child: childId ? { connect: { id: childId } } : undefined,
          answers: {
            createMany: {
              data: answersFor(definition.questions, data.answers),
            },
          },
        },
        include: CASEFORMRESPONSE_DEFAULT_INCLUDE,
      });
    });
  }

  static async update(
    user: FullUser,
    id: string,
    data: CaseFormResponseUpdateRequest
  ) {
    const existing = await prisma.caseFormResponse.findUnique({
      where: { id },
      include: CASEFORMRESPONSE_DEFAULT_INCLUDE,
    });
    if (!existing) throw new NotFoundError();
    if (!canEditCaseFormResponse(user, existing)) throw new ForbiddenError();
    if (!isFamilyMember(existing.case.family, data))
      throw new BadRequestError('Person gehört nicht zur Familie des Falls');

    return prisma.caseFormResponse.update({
      where: { id },
      data: {
        caregiver: relationWrite(data.caregiverId),
        child: relationWrite(data.childId),
        answers: answerWrites(data.answers),
      },
      include: CASEFORMRESPONSE_DEFAULT_INCLUDE,
    });
  }

  static async delete(user: FullUser, id: string) {
    const response = await prisma.caseFormResponse.findFirst({
      where: { id },
      include: CASEFORMRESPONSE_DEFAULT_INCLUDE,
    });
    if (!response) throw new NotFoundError();
    if (!canEditCaseFormResponse(user, response)) throw new ForbiddenError();

    const [, deleted] = await prisma.$transaction([
      prisma.answer.deleteMany({ where: { caseFormResponseId: id } }),
      prisma.caseFormResponse.delete({
        where: { id },
        include: CASEFORMRESPONSE_DEFAULT_INCLUDE,
      }),
    ]);

    return deleted;
  }
}
