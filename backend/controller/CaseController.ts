import { Primitive } from 'zod/v3';
import { Response } from 'express';
import { add } from 'date-fns';
import { prisma } from '../db';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../util/authUtils';
import { PDFService } from '../util/pdfService';
import { deleteStoredFile, streamFile } from '../util/fileStorage';
import { purgeFamilyPersonalData } from '../util/personalDataPurge';
import {
  canCreate,
  canEditCase,
  canHandover,
  canSeeCase,
  canSeeCases,
  caseIncludeFor,
  caseWhereFor,
  contactDocumentationQueryArgsFor,
  contactDocWhereFor,
  MyCasesScope,
  myCasesScopeFilter,
} from './authFns/CaseAuthFns';
import { canPurgeFamily } from './authFns/FamilyAuthFn';
import {
  canDeleteCaseAttachment,
  canSeeCaseAttachments,
  canUploadCaseAttachment,
} from './authFns/CaseAttachmentAuthFns';

import {
  CaseCreateInputObjectSchema,
  CaseIncludeObjectSchema,
  CaseUpdateInputObjectSchema,
  CaseWhereInputObjectSchema,
} from '../../shared/generated/zod/schemas';
import { FullUser } from '../../shared/types';
import { Handover, Prisma } from '../../shared/generated/prisma/client';
import {
  CASE_ATTACHMENT_DEFAULT_INCLUDE,
  CASE_DEFAULT_INCLUDE,
  CONTACT_DOCUMENTATION_DEFAULT_INCLUDE,
  USER_DEFAULT_INCLUDE,
} from '../../shared/consts';

export class CaseController {
  static async getAll(
    user: FullUser,
    where?: Prisma.CaseWhereInput,
    include?: Prisma.CaseInclude
  ) {
    // check for valid inputs, parse throws ZodError
    if (where) CaseWhereInputObjectSchema.parse(where);
    if (include) CaseIncludeObjectSchema.parse(include);

    const cases = await prisma.case.findMany({
      where: caseWhereFor(user, where),
      include: caseIncludeFor(user, include),
    });

    if (!canSeeCases(user, cases))
      throw new ForbiddenError('User not authorized for some of these cases');

    return cases;
  }

  /**
   * Gets cases for the "my cases" dashboard view. `scope` picks which cases count as "mine":
   * 'own' (default, available to everyone) only ever returns cases the user is responsible
   * for; 'org'/'subOrg' additionally let an OrgCoordinator/SubOrgCoordinator browse their whole
   * org's/suborg's cases. The scope's actual org/suborg id is always derived from `user` itself,
   * never trusted from the request, so a Coordinator can't widen this to another org.
   */
  static async getMyCases(
    user: FullUser,
    scope: MyCasesScope,
    where?: Prisma.CaseWhereInput,
    include?: Prisma.CaseInclude
  ) {
    const scopeFilter = myCasesScopeFilter(user, scope);
    if (!scopeFilter)
      throw new ForbiddenError(`Scope "${scope}" not permitted`);

    return this.getAll(user, { ...where, ...scopeFilter }, include);
  }

  static async get(user: FullUser, id: string) {
    const result = await prisma.case.findUnique({
      where: { id },
      include: caseIncludeFor(user),
    });
    if (!result) throw new NotFoundError();
    if (!canSeeCase(user, result)) throw new ForbiddenError();

    return result;
  }

  static async create(user: FullUser, data: Prisma.CaseCreateInput) {
    // check for valid inputs, parse throws ZodError
    CaseCreateInputObjectSchema.parse(data);

    if (!canCreate(user, data))
      throw new ForbiddenError('User not authorized to create this case');

    const result = prisma.case.create({
      data,
      include: caseIncludeFor(user),
    });
    return result;
  }

  static async updateCase(
    user: FullUser,
    id: string,
    data: Prisma.CaseUpdateInput
  ) {
    // check for valid inputs, parse throws ZodError
    CaseUpdateInputObjectSchema.parse(data);

    const c = await prisma.case.findUnique({
      where: { id },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!c) throw new NotFoundError();
    if (!canEditCase(user, c))
      throw new ForbiddenError("User can't edit this case");

    return prisma.case.update({
      where: { id },
      data,
      include: caseIncludeFor(user),
    });
  }

  static async addZiel(
    user: FullUser,
    caseId: string,
    data: {
      startedAt: Date;
      finishBy: Date;
      topic: string;
      description: string;
    }
  ) {
    const c = await prisma.case.findUnique({
      where: { id: caseId },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!c) throw new NotFoundError();
    if (!canEditCase(user, c))
      throw new ForbiddenError("User can't edit this case");

    return prisma.case.update({
      where: { id: caseId },
      data: {
        zielvereinbarungen: {
          create: { ...data, createdBy: { connect: { id: user.id } } },
        },
      },
      include: caseIncludeFor(user),
    });
  }

  static async updateZiel(
    user: FullUser,
    id: string,
    data: Prisma.ZielvereinbarungUpdateInput
  ) {
    const c = await prisma.case.findFirst({
      where: { zielvereinbarungen: { some: { id } } },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!c) throw new NotFoundError();
    if (!canEditCase(user, c))
      throw new ForbiddenError("User can't edit this case");
    return prisma.zielvereinbarung.update({ where: { id }, data });
  }

  static async delete(user: FullUser, id: string) {
    const c = await prisma.case.findUnique({
      where: { id },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!c) throw new NotFoundError();
    if (!canEditCase(user, c))
      throw new ForbiddenError("User can't edit this case");

    return prisma.case.delete({ where: { id }, include: caseIncludeFor(user) });
  }

  static async deleteZiel(user: FullUser, id: string) {
    const c = await prisma.case.findFirst({
      where: { zielvereinbarungen: { some: { id } } },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!c) throw new NotFoundError();
    if (!canEditCase(user, c))
      throw new ForbiddenError("User can't edit this case");

    return prisma.zielvereinbarung.delete({ where: { id } });
  }

  static async getContactDocumentations(
    user: FullUser,
    filter?: Prisma.ContactDocumentationWhereInput
  ) {
    const d = await prisma.contactDocumentation.findMany({
      where: contactDocWhereFor(user, filter),
      ...contactDocumentationQueryArgsFor(user),
    });

    await Promise.all(
      d.map((doc) =>
        prisma.case
          .findUniqueOrThrow({
            where: { id: doc.caseId },
            include: CASE_DEFAULT_INCLUDE,
          })
          .then((c) => {
            if (!canSeeCase(user, c))
              throw new ForbiddenError("User can't access some of these cases");
          })
      )
    );

    return d;
  }

  static async getMyContactDocumentations(
    user: FullUser,
    filter?: Prisma.ContactDocumentationWhereInput
  ) {
    const where: Prisma.ContactDocumentationWhereInput = filter
      ? { ...filter, createdBy: { id: user.id } }
      : { createdBy: { id: user.id } };
    const d = await prisma.contactDocumentation.findMany({
      where: contactDocWhereFor(user, where),
      ...contactDocumentationQueryArgsFor(user),
    });

    await Promise.all(
      d.map((doc) =>
        prisma.case
          .findUniqueOrThrow({
            where: { id: doc.caseId },
            include: CASE_DEFAULT_INCLUDE,
          })
          .then((c) => {
            if (!canSeeCase(user, c))
              throw new ForbiddenError("User can't access some of these cases");
          })
      )
    );

    return d;
  }

  static async getContactDocumentation(user: FullUser, id: string) {
    const d = await prisma.contactDocumentation.findUnique({
      where: { id },
      ...contactDocumentationQueryArgsFor(user),
    });
    if (!d) throw new NotFoundError();
    const c = await prisma.case.findUniqueOrThrow({
      where: { id: d.caseId },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!canSeeCase(user, c))
      throw new ForbiddenError("User can't access this case");

    return d;
  }

  static async getContactDocumentationPDF(user: FullUser, id: string) {
    const d = await prisma.contactDocumentation.findUnique({
      where: { id },
      ...contactDocumentationQueryArgsFor(user),
    });
    if (!d) throw new NotFoundError();
    const c = await prisma.case.findUniqueOrThrow({
      where: { id: d.caseId },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!canSeeCase(user, c))
      throw new ForbiddenError("User can't access this case");

    return PDFService.contactDocumentationPDF(d);
  }

  static async getContactDocumentationForCase(
    user: FullUser,
    caseId: string,
    where?: Prisma.ContactDocumentationWhereInput
  ) {
    const c = await prisma.case.findUnique({
      where: { id: caseId },
      include: CASE_DEFAULT_INCLUDE,
    });

    if (!c) throw new NotFoundError();
    if (!canSeeCase(user, c))
      throw new ForbiddenError("User can't access this case");

    return prisma.contactDocumentation.findMany({
      where: contactDocWhereFor(user, { ...where, caseId }),
      ...contactDocumentationQueryArgsFor(user),
    });
  }

  static async getLatestContactDocumentation(
    user: FullUser,
    caseId: string,
    n?: number
  ) {
    const c = await prisma.case.findUnique({
      where: { id: caseId },
      include: CASE_DEFAULT_INCLUDE,
    });

    if (!c) throw new NotFoundError();
    if (!canSeeCase(user, c))
      throw new ForbiddenError("User can't access this case");

    return await prisma.contactDocumentation.findMany({
      where: { caseId },
      ...contactDocumentationQueryArgsFor(user),
      take: n ?? 5,
      orderBy: { date: { sort: 'desc', nulls: 'last' } },
    });
  }

  static async createContactDocumentation(
    user: FullUser,
    caseId: string,
    input: Prisma.ContactDocumentationCreateInput
  ) {
    const c = await prisma.case.findUnique({
      where: { id: caseId },
      include: { responsibleUsers: true },
    });

    if (!c) throw new NotFoundError();
    if (!canEditCase(user, c))
      throw new ForbiddenError("User can't edit this case");

    return prisma.contactDocumentation.create({
      data: {
        ...input,
        case: { connect: { id: caseId } },
        createdBy: { connect: { id: user.id } },
      },
      ...contactDocumentationQueryArgsFor(user),
    });
  }

  static async updateContactDocumentation(
    user: FullUser,
    id: string,
    input: Prisma.ContactDocumentationUpdateInput
  ) {
    const d = await prisma.contactDocumentation.findUnique({
      where: { id },
      include: CONTACT_DOCUMENTATION_DEFAULT_INCLUDE,
    });

    if (!d) throw new NotFoundError();

    const c = await prisma.case.findUniqueOrThrow({
      where: { id: d?.caseId },
      include: CASE_DEFAULT_INCLUDE,
    });

    if (!canEditCase(user, c))
      throw new ForbiddenError("User can't edit this case");

    return prisma.contactDocumentation.update({
      where: { id },
      data: { ...input },
      ...contactDocumentationQueryArgsFor(user),
    });
  }

  static async deleteContactDocumentation(user: FullUser, id: string) {
    const d = await prisma.contactDocumentation.findUnique({
      where: { id },
      include: CONTACT_DOCUMENTATION_DEFAULT_INCLUDE,
    });

    if (!d) throw new NotFoundError();

    const c = await prisma.case.findUniqueOrThrow({
      where: { id: d?.caseId },
      include: CASE_DEFAULT_INCLUDE,
    });

    if (!canEditCase(user, c))
      throw new ForbiddenError("User can't edit this case");

    return prisma.contactDocumentation.delete({
      where: { id },
      ...contactDocumentationQueryArgsFor(user),
    });
  }

  static async getHandovers(
    user: FullUser,
    caseId: string,
    n?: number
  ): Promise<(Handover & { added: FullUser[]; removed: FullUser[] })[]> {
    const c = await prisma.case.findUnique({
      where: { id: caseId },
      include: CASE_DEFAULT_INCLUDE,
    });

    if (!c) throw new NotFoundError();

    if (!canSeeCase(user, c))
      throw new ForbiddenError("User can't see this case");

    const handovers = await prisma.handover.findMany({
      where: { caseId },
      orderBy: { date: 'desc' },
      take: n || 3,
    });

    const allUserIds = handovers
      .reduce<
        string[]
      >((acc, h) => [...acc, ...h.addedIds, ...h.removedIds], [])
      .filter(unique);

    const users = await prisma.user.findMany({
      where: { id: { in: allUserIds } },
      include: USER_DEFAULT_INCLUDE,
    });

    const res = handovers.map((h) => ({
      ...h,
      notes: h.notes || null,
      added: h.addedIds.map((id) => users.find((u) => u.id === id)!) || [],
      removed: h.removedIds.map((id) => users.find((u) => u.id === id)!) || [],
    }));

    return res;
  }

  static async handover(initiatingUser: FullUser, handover: Handover) {
    const c = await prisma.case.findUnique({
      where: { id: handover.caseId },
      include: { responsibleUsers: true },
    });

    if (!c) throw new NotFoundError();
    if (!canHandover(initiatingUser, c, handover))
      throw new ForbiddenError('Illegal Handover');

    const update = await prisma.case.update({
      where: { id: c.id },
      data: {
        responsibleUsers: {
          disconnect: handover.removedIds.map((id) => ({ id })),
          connect: handover.addedIds.map((id) => ({ id })),
        },
      },
      include: caseIncludeFor(initiatingUser),
    });

    const ho = await prisma.handover.create({
      data: {
        case: { connect: { id: c.id } },
        date: handover.date,
        createdById: initiatingUser.id,
        addedIds: handover.addedIds,
        removedIds: handover.removedIds,
        notes: handover.notes,
      },
    });

    return update;
  }

  /**
   * Closes a case (or changes its closing date if already closed). `personalDataDueAt` is
   * (re)computed as `now() + retention days` every time this runs - deliberately anchored to the
   * actual moment of this call, not to `date` (which is a free-form, possibly-backdated business
   * date the user chooses), so a backdated closure doesn't cause immediate/premature deletion
   * eligibility. Left `null` if no retention period is configured yet.
   */
  static async closeCase(user: FullUser, id: string, date: Date) {
    const c = await prisma.case.findUnique({
      where: { id },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!c) throw new NotFoundError();
    if (!canEditCase(user, c))
      throw new ForbiddenError("User can't close this case");

    const retentionSetting = await prisma.setting.findUnique({
      where: { name: 'personal_data_retention_days' },
    });
    const retentionDays = retentionSetting
      ? parseInt(retentionSetting.value, 10)
      : NaN;
    const personalDataDueAt = Number.isFinite(retentionDays)
      ? add(new Date(), { days: retentionDays })
      : null;

    return prisma.case.update({
      where: { id },
      data: { closedAt: date, personalDataDueAt },
      include: caseIncludeFor(user),
    });
  }

  /**
   * Reverts a case's closure - clears closedAt/personalDataDueAt and deletes the existing
   * "Abschlussdokumentation" response (if any), per requirement that reopening discards it.
   */
  static async reopenCase(user: FullUser, id: string) {
    const c = await prisma.case.findUnique({
      where: { id },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!c) throw new NotFoundError();
    if (!canEditCase(user, c))
      throw new ForbiddenError("User can't reopen this case");

    const closingDocSetting = await prisma.setting.findUnique({
      where: { name: 'closing_doc' },
    });
    if (closingDocSetting) {
      const closingResponse = await prisma.caseFormResponse.findFirst({
        where: { caseId: id, caseFormId: closingDocSetting.value },
      });
      if (closingResponse) {
        await prisma.$transaction([
          prisma.answer.deleteMany({
            where: { caseFormResponseId: closingResponse.id },
          }),
          prisma.caseFormResponse.delete({ where: { id: closingResponse.id } }),
        ]);
      }
    }

    return prisma.case.update({
      where: { id },
      data: { closedAt: null, personalDataDueAt: null },
      include: caseIncludeFor(user),
    });
  }

  /**
   * Manually purges a case's family's personal data right now, regardless of personalDataDueAt -
   * this is the Admin/OrgCoordinator/SubOrgCoordinator "skip the waiting period" override.
   */
  static async purgeFamily(user: FullUser, id: string) {
    const c = await prisma.case.findUnique({
      where: { id },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!c) throw new NotFoundError();
    if (!c.family) throw new NotFoundError('Family already purged');
    if (!canPurgeFamily(user, c.family))
      throw new ForbiddenError("User can't purge this family");

    await purgeFamilyPersonalData(id);
    return prisma.case.findUniqueOrThrow({
      where: { id },
      include: caseIncludeFor(user),
    });
  }

  static async getCaseAttachments(user: FullUser, caseId: string) {
    const c = await prisma.case.findUnique({
      where: { id: caseId },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!c) throw new NotFoundError();
    if (!canSeeCaseAttachments(user, c))
      throw new ForbiddenError("User can't access this case's attachments");

    return prisma.caseAttachment.findMany({
      where: { caseId },
      include: CASE_ATTACHMENT_DEFAULT_INCLUDE,
      omit: { storageKey: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createCaseAttachment(
    user: FullUser,
    caseId: string,
    file: Express.Multer.File | undefined,
    note?: string
  ) {
    const c = await prisma.case.findUnique({
      where: { id: caseId },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!c) throw new NotFoundError();
    if (!canUploadCaseAttachment(user, c))
      throw new ForbiddenError("User can't attach files to this case");
    if (!file) throw new BadRequestError('No file uploaded');

    return prisma.caseAttachment.create({
      data: {
        case: { connect: { id: caseId } },
        filename: file.originalname,
        storageKey: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        note,
        uploadedBy: { connect: { id: user.id } },
      },
      include: CASE_ATTACHMENT_DEFAULT_INCLUDE,
      omit: { storageKey: true },
    });
  }

  static async getCaseAttachmentFile(
    user: FullUser,
    attachmentId: string,
    res: Response
  ) {
    const attachment = await prisma.caseAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundError();

    const c = await prisma.case.findUniqueOrThrow({
      where: { id: attachment.caseId },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!canSeeCaseAttachments(user, c))
      throw new ForbiddenError("User can't access this case's attachments");

    streamFile(
      attachment.storageKey,
      'case-attachments',
      attachment.filename,
      attachment.mimeType,
      res
    );
  }

  static async deleteCaseAttachment(user: FullUser, attachmentId: string) {
    const attachment = await prisma.caseAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) throw new NotFoundError();

    const c = await prisma.case.findUniqueOrThrow({
      where: { id: attachment.caseId },
    });
    if (!canDeleteCaseAttachment(user, attachment, c))
      throw new ForbiddenError("User can't delete this attachment");

    const deleted = await prisma.caseAttachment.delete({
      where: { id: attachmentId },
    });
    deleteStoredFile(deleted.storageKey, 'case-attachments');
    return deleted;
  }
}

function unique<T extends Primitive>(value: T, index: number, array: T[]) {
  return array.indexOf(value) === index;
}
