import { prisma } from '../db';
import { Prisma } from '../../shared/generated/prisma/client';
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
} from './authFns/CaseFormResponseAuthFns';
import { FullUser } from '../../shared/types';
import {
  CASEFORM_DEFAULT_INCLUDE,
  CASEFORMRESPONSE_DEFAULT_INCLUDE,
} from '../../shared/consts';
import { AnswerCreateManyCaseFormResponseInput } from '../../shared/generated/prisma/models';
import { caseFormWhereRestrictions } from './authFns/CaseFormDefinitionAuthFns';

export class CaseFormResponseController {
  static async getAll(user: FullUser) {
    if (user.role !== Role.Admin) throw new ForbiddenError();

    return prisma.caseFormResponse.findMany({
      include: CASEFORMRESPONSE_DEFAULT_INCLUDE,
    });
  }

  static async getWhere(
    user: FullUser,
    where?: Prisma.CaseFormResponseWhereInput
  ) {
    const responses = await prisma.caseFormResponse.findMany({
      where,
      include: CASEFORMRESPONSE_DEFAULT_INCLUDE,
    });
    // TODO: this is very restrictive, consider filtering out bad responses, rather than denying outright
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

  static async create(
    user: FullUser,
    data: Prisma.CaseFormResponseCreateInput
  ) {
    if (!(await canCreateCaseFormResponse(user, data)))
      throw new ForbiddenError();

    if (!data.caseForm?.connect?.id)
      throw new BadRequestError('no definition id');
    if (!data.case.connect?.id) throw new BadRequestError('no case id');

    const caseFormId = data.caseForm.connect.id;
    const caseId = data.case.connect.id;

    const transactionResult = await prisma.$transaction(async (tx) => {
      const definition = await tx.caseForm.findUnique({
        where: {
          id: caseFormId,
          ...caseFormWhereRestrictions(user),
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

      // make sure there is always a "answer" to all questions, so we never run into the issue
      // of having to "upsertMany" which doesn't exist in prisma

      // this shouldn't really happen, but just in case, make sure we're not getting any undefined errors
      if (data.answers?.createMany?.data == undefined)
        data.answers = { createMany: { data: [] } };

      data = {
        ...data,
        answers: {
          createMany: {
            data: definition.questions.map<AnswerCreateManyCaseFormResponseInput>(
              (q) => ({
                questionId: q.id,
                ...(
                  data.answers!.createMany!
                    .data as AnswerCreateManyCaseFormResponseInput[]
                ).find((a) => a.questionId === q.id),
              })
            ),
          },
        },
      };

      return tx.caseFormResponse.create({
        data,
        include: CASEFORMRESPONSE_DEFAULT_INCLUDE,
      });
    });

    return transactionResult;
  }

  static async update(
    user: FullUser,
    id: string,
    data: Prisma.CaseFormResponseUpdateInput
  ) {
    // certain fields should never be changed by a user via an update.
    // TODO: consider providing administration ways around this, especially for createdBy?
    if (data.caseForm || data.createdBy || data.id)
      throw new BadRequestError(
        'request contains fields that should not be updated'
      );

    const existing = await prisma.caseFormResponse.findUnique({
      where: { id },
      include: CASEFORMRESPONSE_DEFAULT_INCLUDE,
    });
    if (!existing) throw new NotFoundError();
    if (!canEditCaseFormResponse(user, existing)) throw new ForbiddenError();

    return prisma.caseFormResponse.update({
      where: { id },
      data,
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
