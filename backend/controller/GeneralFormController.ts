import {
  GENERALFORM_DEFAULT_INCLUDE,
  GENERALFORMRESPONSE_DEFAULT_INCLUDE,
} from '../../shared/consts';
import { FullUser } from '../../shared/types';
import { prisma } from '../db';
import { Role } from '../../shared/generated/prisma/client';
import { ForbiddenError, NotFoundError } from '../util/authUtils';
import {
  canCreateGeneralForm,
  canEditGeneralForm,
  canEditGeneralFormResponse,
  canSeeGeneralFormResponse,
  canSeeGeneralFormResponses,
  generalFormWhereRestrictions,
  visibleGeneralFormResponseWhere,
} from './authFns/GeneralFormAuthFns';
import {
  GeneralFormCreateRequest,
  GeneralFormListQuery,
  GeneralFormResponseCreateRequest,
  GeneralFormResponseUpdateRequest,
  GeneralFormResponseWhere,
  GeneralFormUpdateRequest,
} from '../../shared/api';
import {
  answerWrites,
  answersFor,
  questionWrites,
} from '../util/formWrites';

export class GeneralFormController {
  static getDefinitions(
    user: FullUser,
    where?: GeneralFormListQuery['where']
  ) {
    return prisma.generalForm.findMany({
      where: { AND: [{ ...where }, ...generalFormWhereRestrictions(user)] },
      orderBy: { name: 'asc' },
      include: GENERALFORM_DEFAULT_INCLUDE,
    });
  }

  static async getDefinition(user: FullUser, id: string) {
    const form = await prisma.generalForm.findFirst({
      where: { id, AND: generalFormWhereRestrictions(user) },
      include: GENERALFORM_DEFAULT_INCLUDE,
    });
    if (!form) throw new NotFoundError();
    return form;
  }

  static createDefinition(user: FullUser, data: GeneralFormCreateRequest) {
    if (!canCreateGeneralForm(user)) throw new ForbiddenError();

    const { questions, ...fields } = data;

    return prisma.generalForm.create({
      data: {
        ...fields,
        // Admin/Controller create global forms, OrgController forms of their own organisation
        organisationId:
          user.role === Role.OrgController ? user.organisationId : null,
        questions: { createMany: { data: questions } },
      },
      include: GENERALFORM_DEFAULT_INCLUDE,
    });
  }

  static async updateDefinition(
    user: FullUser,
    id: string,
    data: GeneralFormUpdateRequest
  ) {
    const existing = await prisma.generalForm.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError();
    if (!canEditGeneralForm(user, existing)) throw new ForbiddenError();

    const { questions, deletedQuestionIds, ...fields } = data;

    return prisma.generalForm.update({
      where: { id },
      data: {
        ...fields,
        questions: questionWrites({ questions, deletedQuestionIds }),
      },
      include: GENERALFORM_DEFAULT_INCLUDE,
    });
  }

  static async deleteDefinition(user: FullUser, id: string) {
    const existing = await prisma.generalForm.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError();
    if (!canEditGeneralForm(user, existing)) throw new ForbiddenError();

    return prisma.generalForm.delete({
      where: { id },
      include: GENERALFORM_DEFAULT_INCLUDE,
    });
  }

  static async getResponses(user: FullUser, where: GeneralFormResponseWhere = {}) {
    const responses = await prisma.generalFormResponse.findMany({
      where: { AND: [where, visibleGeneralFormResponseWhere(user)] },
      include: GENERALFORMRESPONSE_DEFAULT_INCLUDE,
    });

    if (!canSeeGeneralFormResponses(user, responses))
      throw new ForbiddenError();

    return responses;
  }

  static async getResponse(user: FullUser, id: string) {
    const response = await prisma.generalFormResponse.findUnique({
      where: { id },
      include: GENERALFORMRESPONSE_DEFAULT_INCLUDE,
    });

    if (!response) throw new NotFoundError();
    if (!canSeeGeneralFormResponse(user, response)) throw new ForbiddenError();

    return response;
  }

  static async createResponse(
    user: FullUser,
    data: GeneralFormResponseCreateRequest
  ) {
    const definition = await prisma.generalForm.findFirst({
      where: {
        id: data.generalFormId,
        AND: generalFormWhereRestrictions(user),
      },
      include: GENERALFORM_DEFAULT_INCLUDE,
    });
    if (!definition) throw new NotFoundError();

    return prisma.generalFormResponse.create({
      data: {
        form: { connect: { id: definition.id } },
        createdBy: { connect: { id: user.id } },
        answers: {
          createMany: { data: answersFor(definition.questions, data.answers) },
        },
      },
      include: GENERALFORMRESPONSE_DEFAULT_INCLUDE,
    });
  }

  static async updateResponse(
    user: FullUser,
    id: string,
    data: GeneralFormResponseUpdateRequest
  ) {
    const response = await prisma.generalFormResponse.findUnique({
      where: { id },
      include: GENERALFORMRESPONSE_DEFAULT_INCLUDE,
    });

    if (!response) throw new NotFoundError();
    if (!canEditGeneralFormResponse(user, response)) throw new ForbiddenError();

    return prisma.generalFormResponse.update({
      where: { id },
      data: { answers: answerWrites(data.answers) },
      include: GENERALFORMRESPONSE_DEFAULT_INCLUDE,
    });
  }

  static async deleteResponse(user: FullUser, id: string) {
    const response = await prisma.generalFormResponse.findUnique({
      where: { id },
      include: GENERALFORMRESPONSE_DEFAULT_INCLUDE,
    });

    if (!response) throw new NotFoundError();
    if (!canEditGeneralFormResponse(user, response)) throw new ForbiddenError();

    const [, deleted] = await prisma.$transaction([
      prisma.answer.deleteMany({ where: { generalFormResponseId: id } }),
      prisma.generalFormResponse.delete({
        where: { id },
        include: GENERALFORMRESPONSE_DEFAULT_INCLUDE,
      }),
    ]);

    return deleted;
  }
}
