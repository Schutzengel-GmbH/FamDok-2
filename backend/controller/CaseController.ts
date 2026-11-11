import { Primitive } from 'zod/v3';
import { Response } from 'express';
import { add, differenceInMinutes } from 'date-fns';
import { prisma } from '../db';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../util/authUtils';
import fs from 'fs';
import { deleteStoredFile, streamFile } from '../util/fileStorage';
import {
  assertBlobWrite,
  assertClientId,
  assertFieldWrite,
  encryptionPolicyFor,
} from '../util/encryptionPolicy';
import { clearedBlobFields } from '../../shared/utils/encryptedModels';
import {
  BYTES_HEADER_LENGTH,
  isBytesEnvelope,
  parseBytesEnvelope,
} from '../../shared/utils/ciphertext';
import { purgeFamilyPersonalData } from '../util/personalDataPurge';
import {
  canEditCase,
  canHandover,
  canSeeCase,
  canSeeCases,
  caseIncludeFor,
  caseWhereFor,
  contactDocumentationQueryArgsFor,
  contactDocWhereFor,
  visibleCaseWhere,
  MyCasesScope,
  myCasesScopeFilter,
} from './authFns/CaseAuthFns';
import { canPurgeFamily } from './authFns/FamilyAuthFn';
import {
  canDeleteCaseAttachment,
  canSeeCaseAttachments,
  canUploadCaseAttachment,
} from './authFns/CaseAttachmentAuthFns';

import { FullCase, FullUser } from '../../shared/types';
import { Handover, Prisma } from '../../shared/generated/prisma/client';
import {
  CASE_ATTACHMENT_DEFAULT_INCLUDE,
  CASE_DEFAULT_INCLUDE,
  CONTACT_DOCUMENTATION_DEFAULT_INCLUDE,
  USER_DEFAULT_INCLUDE,
} from '../../shared/consts';
import { canCreateFamily } from './authFns/FamilyAuthFn';
import {
  CaseAttachmentRequest,
  CaseCreateRequest,
  CaseWhere,
  ContactDocumentationCreateRequest,
  ContactDocumentationUpdateRequest,
  ContactDocumentationWhere,
  HandoverRequest,
  MyCasesQuery,
  ZielCreateRequest,
  ZielUpdateRequest,
} from '../../shared/api';

/** Mime types of attachment contents, as for unencrypted uploads (see middleware/upload.ts). */
const ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/** Reads the first bytes of a stored upload, enough for the `FDK1` header. */
async function readHeader(path: string): Promise<Uint8Array> {
  const handle = await fs.promises.open(path, 'r');
  try {
    const buffer = new Uint8Array(BYTES_HEADER_LENGTH + 16);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** If the documentation has a start and end, the duration follows from them. */
function withDuration<T extends ContactDocumentationCreateRequest>(input: T): T {
  return input.start && input.end
    ? {
        ...input,
        duration: differenceInMinutes(new Date(input.end), new Date(input.start)),
      }
    : input;
}

const LATEST_CONTACT_INCLUDE = {
  contactDocumentation: {
    orderBy: { date: { sort: 'desc', nulls: 'last' } },
    take: 1,
  },
} satisfies Prisma.CaseInclude;

export class CaseController {
  static async getAll(
    user: FullUser,
    where: CaseWhere = {},
    {
      scope = {},
      include,
    }: { scope?: Prisma.CaseWhereInput; include?: Prisma.CaseInclude } = {}
  ) {
    const cases = await prisma.case.findMany({
      where: {
        AND: [caseWhereFor(user, where)!, scope, visibleCaseWhere(user)],
      },
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
    { where, scope = 'own', preset }: MyCasesQuery
  ) {
    const scopeFilter = myCasesScopeFilter(user, scope);
    if (!scopeFilter)
      throw new ForbiddenError(`Scope "${scope}" not permitted`);

    return this.getAll(user, where, {
      scope: scopeFilter,
      include: preset === 'latestContact' ? LATEST_CONTACT_INCLUDE : undefined,
    });
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

  /**
   * Creates a case with its family. In encrypted orgs the browser chose all ids, the family,
   * children and caregivers come as blobs, and `city`/`plz` are the plaintext statistics copy
   * of the address; otherwise they are taken from the plaintext address as before.
   */
  static async create(user: FullUser, data: CaseCreateRequest) {
    if (!canCreateFamily(user)) throw new ForbiddenError();

    const policy = await encryptionPolicyFor(user.organisationId);
    const { family, ...fields } = data;
    const { children = [], caregivers = [], adress, ...familyFields } = family;
    assertClientId(policy, fields.id, 'Case');
    assertFieldWrite(policy, 'Case', fields);
    assertClientId(policy, familyFields.id, 'Family');
    assertBlobWrite(policy, 'Family', { ...familyFields, adress }, true);
    for (const child of children) {
      assertClientId(policy, child.id, 'Child');
      assertBlobWrite(policy, 'Child', child, true);
    }
    for (const caregiver of caregivers) {
      assertClientId(policy, caregiver.id, 'Caregiver');
      assertBlobWrite(policy, 'Caregiver', caregiver, true);
    }
    const organisation = { connect: { id: user.organisationId! } };

    return prisma.case.create({
      data: {
        ...fields,
        city: fields.city ?? adress?.city,
        plz: fields.plz ?? adress?.plz,
        organisation,
        createdBy: { connect: { id: user.id } },
        responsibleUsers: { connect: { id: user.id } },
        family: {
          create: {
            ...familyFields,
            adress: adress as PrismaJson.Address | undefined,
            organisation,
            children: {
              createMany: {
                data: children as Prisma.ChildCreateManyFamilyInput[],
              },
            },
            caregiver: { createMany: { data: caregivers } },
          },
        },
      },
      include: caseIncludeFor(user),
    });
  }

  static async addZiel(
    user: FullUser,
    caseId: string,
    data: ZielCreateRequest
  ) {
    const c = await prisma.case.findUnique({
      where: { id: caseId },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!c) throw new NotFoundError();
    if (!canEditCase(user, c))
      throw new ForbiddenError("User can't edit this case");
    const policy = await encryptionPolicyFor(c.organisationId);
    assertClientId(policy, data.id, 'Zielvereinbarung');
    assertFieldWrite(policy, 'Zielvereinbarung', data);

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
    data: ZielUpdateRequest
  ) {
    const c = await prisma.case.findFirst({
      where: { zielvereinbarungen: { some: { id } } },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!c) throw new NotFoundError();
    if (!canEditCase(user, c))
      throw new ForbiddenError("User can't edit this case");
    assertFieldWrite(
      await encryptionPolicyFor(c.organisationId),
      'Zielvereinbarung',
      data
    );
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
    filter: ContactDocumentationWhere = {}
  ) {
    const d = await prisma.contactDocumentation.findMany({
      where: {
        AND: [
          contactDocWhereFor(user, filter)!,
          { case: visibleCaseWhere(user) },
        ],
      },
      ...contactDocumentationQueryArgsFor(user),
    });

    d.forEach((doc) => {
      // I think we can make this assertion because if the case does not
      // include responsibleUsers, the canSeeCase should correctly reject
      if (!canSeeCase(user, doc.case as FullCase))
        throw new ForbiddenError("User can't access some of these cases");
    });

    return d;
  }

  static async getMyContactDocumentations(
    user: FullUser,
    filter: ContactDocumentationWhere = {}
  ) {
    const d = await prisma.contactDocumentation.findMany({
      where: {
        AND: [
          contactDocWhereFor(user, filter)!,
          { userId: user.id, case: visibleCaseWhere(user) },
        ],
      },
      ...contactDocumentationQueryArgsFor(user),
    });

    d.forEach((doc) => {
      // I think we can make this assertion because if the case does not
      // include responsibleUsers, the canSeeCase should correctly reject
      if (!canSeeCase(user, doc.case as FullCase))
        throw new ForbiddenError("User can't access some of these cases");
    });

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

  static async getContactDocumentationForCase(
    user: FullUser,
    caseId: string,
    where?: ContactDocumentationWhere
  ) {
    const c = await prisma.case.findUnique({
      where: { id: caseId },
      include: CASE_DEFAULT_INCLUDE,
    });

    if (!c) throw new NotFoundError();
    if (!canSeeCase(user, c))
      throw new ForbiddenError("User can't access this case");

    return prisma.contactDocumentation.findMany({
      where: { ...contactDocWhereFor(user, where), caseId },
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
    input: ContactDocumentationCreateRequest
  ) {
    const c = await prisma.case.findUnique({
      where: { id: caseId },
      include: { responsibleUsers: true },
    });

    if (!c) throw new NotFoundError();
    if (!canEditCase(user, c))
      throw new ForbiddenError("User can't edit this case");
    const policy = await encryptionPolicyFor(c.organisationId);
    assertClientId(policy, input.id, 'ContactDocumentation');
    assertFieldWrite(policy, 'ContactDocumentation', input);

    return prisma.contactDocumentation.create({
      data: {
        ...withDuration(input),
        case: { connect: { id: caseId } },
        createdBy: { connect: { id: user.id } },
      },
      ...contactDocumentationQueryArgsFor(user),
    });
  }

  static async updateContactDocumentation(
    user: FullUser,
    id: string,
    input: ContactDocumentationUpdateRequest
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
    assertFieldWrite(
      await encryptionPolicyFor(c.organisationId),
      'ContactDocumentation',
      input
    );

    return prisma.contactDocumentation.update({
      where: { id },
      data: withDuration(input),
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
      take: n ?? 3,
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

  static async handover(initiatingUser: FullUser, handover: HandoverRequest) {
    const c = await prisma.case.findUnique({
      where: { id: handover.caseId },
      include: { responsibleUsers: true },
    });

    if (!c) throw new NotFoundError();
    if (!(await canHandover(initiatingUser, c, handover)))
      throw new ForbiddenError('Illegal Handover');
    const policy = await encryptionPolicyFor(c.organisationId);
    assertClientId(policy, handover.id, 'Handover');
    assertFieldWrite(policy, 'Handover', { notes: handover.notes });

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
        id: policy.active ? handover.id : undefined,
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

  /**
   * Stores an uploaded attachment. In encrypted orgs the upload is an `FDK1` envelope under the
   * current key version, filename and note are envelopes, and the real mime type comes in the
   * body; anything else is deleted again and refused.
   */
  static async createCaseAttachment(
    user: FullUser,
    caseId: string,
    file: Express.Multer.File | undefined,
    body: CaseAttachmentRequest = {}
  ) {
    const c = await prisma.case.findUnique({
      where: { id: caseId },
      include: CASE_DEFAULT_INCLUDE,
    });
    if (!c) throw new NotFoundError();
    if (!canUploadCaseAttachment(user, c))
      throw new ForbiddenError("User can't attach files to this case");
    if (!file) throw new BadRequestError('No file uploaded');

    const policy = await encryptionPolicyFor(c.organisationId);
    let contentKeyVersion: number | null = null;
    try {
      if (policy.active) {
        assertClientId(policy, body.id, 'CaseAttachment');
        assertFieldWrite(policy, 'CaseAttachment', body);
        if (!body.filename)
          throw new BadRequestError('CaseAttachment.filename is missing');
        if (!body.mimeType || !ATTACHMENT_MIME_TYPES.has(body.mimeType))
          throw new BadRequestError('CaseAttachment.mimeType is not allowed');
        const header = await readHeader(file.path);
        if (
          !isBytesEnvelope(header) ||
          parseBytesEnvelope(header).keyVersion !== policy.keyVersion
        )
          throw new BadRequestError('The file must be encrypted with the current key');
        contentKeyVersion = policy.keyVersion;
      } else if (file.mimetype === 'application/octet-stream') {
        throw new BadRequestError(`File type ${file.mimetype} is not allowed`);
      }
    } catch (e) {
      deleteStoredFile(file.filename, 'case-attachments');
      throw e;
    }

    return prisma.caseAttachment.create({
      data: {
        id: policy.active ? body.id : undefined,
        case: { connect: { id: caseId } },
        filename: policy.active ? body.filename! : file.originalname,
        storageKey: file.filename,
        mimeType: policy.active ? body.mimeType! : file.mimetype,
        size: file.size,
        note: body.note,
        contentKeyVersion,
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

    // encrypted contents go out as opaque bytes; the browser decrypts name and content
    const encrypted = attachment.contentKeyVersion !== null;
    streamFile(
      attachment.storageKey,
      'case-attachments',
      encrypted ? 'attachment.bin' : attachment.filename,
      encrypted ? 'application/octet-stream' : attachment.mimeType,
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
