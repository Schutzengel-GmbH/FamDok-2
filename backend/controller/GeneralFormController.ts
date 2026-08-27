import {
  GENERALFORM_DEFAULT_INCLUDE,
  GENERALFORMRESPONSE_DEFAULT_INCLUDE,
} from '../../shared/consts';
import { FullUser } from '../../shared/types';
import { prisma } from '../db';
import { Prisma, Role } from '../../shared/generated/prisma/client';
import { ForbiddenError, NotFoundError } from '../util/authUtils';
import {
  canCreateGeneralForm,
  canEditGeneralForm,
  canEditGeneralFormResponse,
  canSeeGeneralFormResponse,
  canSeeGeneralFormResponses,
  generalFormWhereRestrictions,
} from './authFns/GeneralFormAuthFns';
import { AnswerCreateManyGeneralFormResponseInput } from '../../shared/generated/prisma/models';

export class GeneralFormController {
  static getDefinitions(user: FullUser, where?: Prisma.GeneralFormWhereInput) {
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

  static createDefinition(user: FullUser, data: Prisma.GeneralFormCreateInput) {
    if (!canCreateGeneralForm(user, data)) throw new ForbiddenError();

    return prisma.generalForm.create({
      data,
      include: GENERALFORM_DEFAULT_INCLUDE,
    });
  }

  static async updateDefinition(
    user: FullUser,
    id: string,
    data: Prisma.GeneralFormUpdateInput
  ) {
    const existing = await prisma.generalForm.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError();
    if (!canEditGeneralForm(user, existing)) throw new ForbiddenError();

    // OrgController can't move a form to another org or make it global - only Admin/Controller
    // (who bypass this check above) may change organisationId.
    if (user.role === Role.OrgController) delete data.organisation;

    return prisma.generalForm.update({
      where: { id },
      data,
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

  static async getResponses(
    user: FullUser,
    where: Prisma.GeneralFormResponseWhereInput
  ) {
    const responses = await prisma.generalFormResponse.findMany({
      where,
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
    data: Prisma.GeneralFormResponseCreateInput
  ) {
    const definition = await prisma.generalForm.findUniqueOrThrow({
      where: { id: data?.form?.connect?.id },
      include: GENERALFORM_DEFAULT_INCLUDE,
    });

    // make sure there is always a "answer" to all questions, so we never run into the issue
    // of having to "upsertMany" which doesn't exist in prisma

    // this shouldn't really happen, but just in case, make sure we're not getting any undefined errors
    if (data.answers?.createMany?.data == undefined)
      data.answers = { createMany: { data: [] } };

    data = {
      ...data,
      answers: {
        createMany: {
          data: definition!.questions.map<AnswerCreateManyGeneralFormResponseInput>(
            (q) => ({
              questionId: q.id,
              ...(
                data.answers!.createMany!
                  .data as AnswerCreateManyGeneralFormResponseInput[]
              ).find((a) => a.questionId === q.id),
            })
          ),
        },
      },
    };

    return prisma.generalFormResponse.create({
      data: {
        ...data,
        createdBy: { connect: { id: user.id } },
      },
      include: GENERALFORMRESPONSE_DEFAULT_INCLUDE,
    });
  }

  static async updateResponse(
    user: FullUser,
    id: string,
    data: Prisma.GeneralFormResponseUpdateInput
  ) {
    const response = await prisma.generalFormResponse.findUnique({
      where: { id },
      include: GENERALFORMRESPONSE_DEFAULT_INCLUDE,
    });

    if (!response) throw new NotFoundError();
    if (!canEditGeneralFormResponse(user, response)) throw new ForbiddenError();

    return prisma.generalFormResponse.update({
      where: { id },
      data,
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
