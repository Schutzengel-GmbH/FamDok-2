import { createHash, randomUUID } from 'node:crypto';
import fs from 'fs';
import { prisma } from '../db';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../util/authUtils';
import { FullUser } from '../../shared/types';
import {
  AttachmentContentQuery,
  GrantRequest,
  KdfParamsWire,
  KeyStatus,
  MigrationStatus,
  OrgKeyEventView,
  OrgKeyMember,
  OrgSetupRequest,
  PassphraseChangeRequest,
  RecoveryKeys,
  ReencryptRowsQuery,
  ReencryptRowsRequest,
  RotationCompleteRequest,
  RotationStartRequest,
  UserKeyRequest,
} from '../../shared/api';
import {
  OrgKeyEventType,
  Organisation,
  Prisma,
} from '../../shared/generated/prisma/client';
import {
  envelopeKeyVersion,
  fromB64Url,
  isBytesEnvelope,
  parseBytesEnvelope,
  parseRecoveryWrappedKey,
} from '../../shared/utils/ciphertext';
import { formatFingerprint } from '../../shared/utils/recoveryCode';
import {
  canFreezeOrg,
  canManageOrgKeys,
  roleNeedsKeys,
  userNeedsKeys,
} from './authFns/KeyAuthFns';
import {
  ReencryptMode,
  countPending,
  findPending,
  orgScope,
  storeReencrypted,
} from '../util/encryptedRows';
import { resolveStoragePath, deleteStoredFile } from '../util/fileStorage';

const USER_SUMMARY = {
  select: { id: true, firstName: true, lastName: true, email: true },
} as const;

/** Fingerprint of a public key as stored in the key log, same format the browser shows. */
export function publicKeyFingerprint(publicKey: string): string {
  return formatFingerprint(
    new Uint8Array(createHash('sha256').update(fromB64Url(publicKey)).digest())
  );
}

/**
 * Key management of the org encryption. Everything here moves public keys, wrapped keys, grants
 * and ciphertext between browsers; the server never sees a passphrase, a private key or a data
 * key. Authorization mirrors the design: users manage their own key pair, OrgCoordinators manage
 * their org's grants, freezing is also open to the Admin.
 */
export class KeyController {
  /** Loads an organisation or throws NotFound. */
  private static async loadOrg(orgId: string): Promise<Organisation> {
    const org = await prisma.organisation.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundError('Organisation not found');
    return org;
  }

  /** Loads an org the user manages the keys of, or throws. */
  private static async managedOrg(user: FullUser, orgId: string) {
    if (!canManageOrgKeys(user, orgId)) throw new ForbiddenError();
    return KeyController.loadOrg(orgId);
  }

  /** Appends an entry to the org's key log. */
  private static async log(
    tx: Prisma.TransactionClient | typeof prisma,
    organisationId: string,
    type: OrgKeyEventType,
    data: {
      actorId?: string | null;
      subjectId?: string | null;
      keyVersion?: number | null;
      fingerprint?: string | null;
    } = {}
  ) {
    await tx.orgKeyEvent.create({ data: { organisationId, type, ...data } });
  }

  /**
   * Everything the browser needs to unlock: org key state, the user's wrapped key pair, all
   * their grants in the org and the key continuity proofs. The browser decides which versions to
   * trust; the server only hands the material over.
   */
  static async getStatus(user: FullUser): Promise<KeyStatus> {
    const [org, userKey] = await Promise.all([
      user.organisationId
        ? prisma.organisation.findUnique({ where: { id: user.organisationId } })
        : null,
      prisma.userKey.findUnique({ where: { userId: user.id } }),
    ]);

    const [grants, keyProofs] = org
      ? await Promise.all([
          prisma.orgKeyGrant.findMany({
            where: { organisationId: org.id, userId: user.id },
            select: { keyVersion: true, wrappedKey: true, publicKey: true },
            orderBy: { keyVersion: 'asc' },
          }),
          prisma.orgKeyProof.findMany({
            where: { organisationId: org.id },
            select: { keyVersion: true, proof: true },
            orderBy: { keyVersion: 'asc' },
          }),
        ])
      : [[], []];

    return {
      org: org && {
        id: org.id,
        name: org.name,
        keyState: org.keyState,
        keyVersion: org.keyVersion,
        pendingKeyVersion: org.pendingKeyVersion,
        frozenAt: org.frozenAt,
      },
      userKey: userKey && {
        publicKey: userKey.publicKey,
        wrappedPrivateKey: userKey.wrappedPrivateKey,
        kdfParams: userKey.kdfParams as KdfParamsWire,
      },
      grants,
      keyProofs,
      canManageKeys: !!org && canManageOrgKeys(user, org.id),
      needsKeys: userNeedsKeys(user),
    };
  }

  /**
   * Stores the user's key pair. A second call needs `replace`: re-enrolling means a new key pair,
   * so every grant sealed to the old one is deleted and a coordinator has to grant again.
   */
  static async enrol(user: FullUser, data: UserKeyRequest) {
    if (!userNeedsKeys(user))
      throw new ForbiddenError('This role does not use encryption keys');

    const existing = await prisma.userKey.findUnique({
      where: { userId: user.id },
    });
    if (existing && !data.replace)
      throw new ConflictError('A key pair already exists for this user');

    const fingerprint = publicKeyFingerprint(data.publicKey);
    const { replace, ...key } = data;

    return prisma.$transaction(async (tx) => {
      if (existing)
        await tx.orgKeyGrant.deleteMany({ where: { userId: user.id } });
      const stored = await tx.userKey.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...key },
        update: key,
      });
      await KeyController.log(
        tx,
        user.organisationId!,
        existing ? OrgKeyEventType.reenrol : OrgKeyEventType.enrol,
        { actorId: user.id, subjectId: user.id, fingerprint }
      );
      return { publicKey: stored.publicKey, fingerprint };
    });
  }

  /** Replaces the wrapped private key after a passphrase change; the key pair stays the same. */
  static async changePassphrase(user: FullUser, data: PassphraseChangeRequest) {
    const existing = await prisma.userKey.findUnique({
      where: { userId: user.id },
    });
    if (!existing) throw new NotFoundError('No key pair to re-wrap');

    await prisma.userKey.update({ where: { userId: user.id }, data });
    if (user.organisationId)
      await KeyController.log(
        prisma,
        user.organisationId,
        OrgKeyEventType.passphraseChanged,
        { actorId: user.id, subjectId: user.id }
      );
  }

  /**
   * Activates the encryption of an organisation: the first coordinator uploads their self-grant
   * for key version 1 and the recovery-wrapped key. An org that is already set up can't be set up
   * again, so an operator can't quietly replace its key.
   */
  static async setupOrg(user: FullUser, orgId: string, data: OrgSetupRequest) {
    await KeyController.managedOrg(user, orgId);
    const userKey = await prisma.userKey.findUnique({
      where: { userId: user.id },
    });
    if (!userKey)
      throw new BadRequestError('Set up your own key pair before the organisation');
    if (parseRecoveryWrappedKey(data.recoveryWrappedKey).keyVersion !== 1)
      throw new BadRequestError('The recovery-wrapped key must be for key version 1');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.organisation.updateMany({
        where: { id: orgId, keyState: 'uninitialized' },
        data: {
          keyState: 'active',
          keyVersion: 1,
          recoveryWrappedKey: data.recoveryWrappedKey,
        },
      });
      if (updated.count !== 1)
        throw new ConflictError('The encryption of this organisation is already set up');

      await tx.orgKeyGrant.create({
        data: {
          organisationId: orgId,
          userId: user.id,
          grantedById: user.id,
          keyVersion: 1,
          wrappedKey: data.grant,
          publicKey: userKey.publicKey,
        },
      });
      await KeyController.log(tx, orgId, OrgKeyEventType.setup, {
        actorId: user.id,
        subjectId: user.id,
        keyVersion: 1,
        fingerprint: publicKeyFingerprint(userKey.publicKey),
      });
      return { keyVersion: 1 };
    });
  }

  /**
   * The org's members for the key management page: whether they have enrolled, their public key
   * (the coordinator's browser computes the fingerprint from it) and their current grant.
   */
  static async getMembers(user: FullUser, orgId: string): Promise<OrgKeyMember[]> {
    const org = await KeyController.managedOrg(user, orgId);
    const users = await prisma.user.findMany({
      where: { organisationId: orgId },
      include: {
        userKey: true,
        keyGrants: { where: { organisationId: orgId, keyVersion: org.keyVersion } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      publicKey: u.userKey?.publicKey ?? null,
      enrolledAt: u.userKey?.createdAt ?? null,
      grant: u.keyGrants[0]
        ? {
            keyVersion: u.keyGrants[0].keyVersion,
            publicKey: u.keyGrants[0].publicKey,
            createdAt: u.keyGrants[0].createdAt,
            grantedById: u.keyGrants[0].grantedById,
          }
        : null,
      needsKeys: roleNeedsKeys(u.role),
    }));
  }

  /**
   * Stores a grant a coordinator's browser sealed for a member. The member must belong to the
   * org, work with personal data, and still have the key pair the grant was sealed to. Grants
   * are for the current version; while a rotation runs also for the pending one, so a key
   * manager can recover both keys and resume a rotation another one started.
   */
  static async grant(user: FullUser, orgId: string, data: GrantRequest) {
    const org = await KeyController.managedOrg(user, orgId);
    const allowedVersions =
      org.keyState === 'rotating'
        ? [org.keyVersion, org.pendingKeyVersion]
        : org.keyState === 'active'
          ? [org.keyVersion]
          : [];
    if (!allowedVersions.includes(data.keyVersion))
      throw new BadRequestError(
        `Grants can only be given for key version ${allowedVersions.join(', ') || '(none)'} now`
      );

    const recipient = await prisma.user.findUnique({
      where: { id: data.userId },
      include: { userKey: true },
    });
    if (!recipient || recipient.organisationId !== orgId)
      throw new NotFoundError('User not found in this organisation');
    if (!roleNeedsKeys(recipient.role))
      throw new BadRequestError('This role does not use encryption keys');
    if (!recipient.userKey || recipient.userKey.publicKey !== data.publicKey)
      throw new ConflictError(
        'The user has a different key pair now; check the fingerprint again'
      );

    const fingerprint = publicKeyFingerprint(data.publicKey);
    return prisma.$transaction(async (tx) => {
      const grant = await tx.orgKeyGrant.upsert({
        where: {
          organisationId_userId_keyVersion: {
            organisationId: orgId,
            userId: data.userId,
            keyVersion: data.keyVersion,
          },
        },
        create: {
          organisationId: orgId,
          userId: data.userId,
          grantedById: user.id,
          keyVersion: data.keyVersion,
          wrappedKey: data.wrappedKey,
          publicKey: data.publicKey,
        },
        update: {
          grantedById: user.id,
          wrappedKey: data.wrappedKey,
          publicKey: data.publicKey,
        },
        select: { id: true, keyVersion: true, createdAt: true },
      });
      await KeyController.log(
        tx,
        orgId,
        data.userId === user.id ? OrgKeyEventType.recovery : OrgKeyEventType.grant,
        {
          actorId: user.id,
          subjectId: data.userId,
          keyVersion: data.keyVersion,
          fingerprint,
        }
      );
      return grant;
    });
  }

  /** Deletes every grant of a member, e.g. before disabling them or after a lost device. */
  static async revoke(user: FullUser, orgId: string, userId: string) {
    await KeyController.managedOrg(user, orgId);
    const { count } = await prisma.orgKeyGrant.deleteMany({
      where: { organisationId: orgId, userId },
    });
    if (count > 0)
      await KeyController.log(prisma, orgId, OrgKeyEventType.revoke, {
        actorId: user.id,
        subjectId: userId,
      });
    return { revoked: count };
  }

  /** The newest 300 entries of the org's key log. */
  static async getEvents(user: FullUser, orgId: string): Promise<OrgKeyEventView[]> {
    await KeyController.managedOrg(user, orgId);
    return prisma.orgKeyEvent.findMany({
      where: { organisationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        type: true,
        createdAt: true,
        keyVersion: true,
        fingerprint: true,
        actor: USER_SUMMARY,
        subject: USER_SUMMARY,
      },
    });
  }

  /**
   * The recovery-wrapped keys, for a key manager who lost access: the current version's and,
   * during a rotation, the pending version's. Useless without their recovery codes, which never
   * leave the org's safe.
   */
  static async getRecovery(user: FullUser, orgId: string): Promise<RecoveryKeys> {
    const org = await KeyController.managedOrg(user, orgId);
    const keys: RecoveryKeys = [];
    if (org.recoveryWrappedKey)
      keys.push({ keyVersion: org.keyVersion, recoveryWrappedKey: org.recoveryWrappedKey });
    if (org.keyState === 'rotating' && org.pendingKeyVersion && org.pendingRecoveryWrappedKey)
      keys.push({
        keyVersion: org.pendingKeyVersion,
        recoveryWrappedKey: org.pendingRecoveryWrappedKey,
      });
    if (keys.length === 0)
      throw new NotFoundError('This organisation has no recovery key');
    return keys;
  }

  /** Freezes an org: its members can't read or write org data until it is unfrozen. */
  static async freeze(user: FullUser, orgId: string) {
    if (!canFreezeOrg(user, orgId)) throw new ForbiddenError();
    const updated = await prisma.organisation.updateMany({
      where: { id: orgId, keyState: 'active' },
      data: { keyState: 'frozen', frozenAt: new Date() },
    });
    if (updated.count !== 1)
      throw new ConflictError('Only an active organisation can be frozen');
    await KeyController.log(prisma, orgId, OrgKeyEventType.freeze, {
      actorId: user.id,
    });
  }

  /** Unfreezes a frozen org. A running rotation can only end by completing. */
  static async unfreeze(user: FullUser, orgId: string) {
    if (!canFreezeOrg(user, orgId)) throw new ForbiddenError();
    const updated = await prisma.organisation.updateMany({
      where: { id: orgId, keyState: 'frozen' },
      data: { keyState: 'active', frozenAt: null },
    });
    if (updated.count !== 1)
      throw new ConflictError('Only a frozen organisation can be unfrozen');
    await KeyController.log(prisma, orgId, OrgKeyEventType.unfreeze, {
      actorId: user.id,
    });
  }

  /**
   * Starts a rotation of a frozen org: the key manager's browser generated the next key version
   * and uploads its own grant for it first, so an interrupted rotation can be resumed. It also
   * uploads the continuity proof that other browsers check before they trust the new version,
   * and the new key wrapped under the new recovery code, so the new key survives even if the key
   * manager loses their grant before the rotation is complete.
   *
   * The state change only applies to a frozen org still on the version the proof was made for,
   * so of two concurrent starts exactly one wins and the other changes nothing.
   */
  static async startRotation(user: FullUser, orgId: string, data: RotationStartRequest) {
    const org = await KeyController.managedOrg(user, orgId);
    if (org.keyState !== 'frozen')
      throw new ConflictError('Freeze the organisation before rotating its key');
    if (data.keyVersion !== org.keyVersion + 1)
      throw new BadRequestError(`The new key version must be ${org.keyVersion + 1}`);
    if (envelopeKeyVersion(data.proof) !== org.keyVersion)
      throw new BadRequestError(
        `The proof must be encrypted with the current key version ${org.keyVersion}`
      );
    if (parseRecoveryWrappedKey(data.recoveryWrappedKey).keyVersion !== data.keyVersion)
      throw new BadRequestError(`The recovery key must be for key version ${data.keyVersion}`);
    const userKey = await prisma.userKey.findUnique({ where: { userId: user.id } });
    if (!userKey) throw new BadRequestError('You have no key pair');

    await prisma.$transaction(async (tx) => {
      const started = await tx.organisation.updateMany({
        where: { id: orgId, keyState: 'frozen', keyVersion: org.keyVersion },
        data: {
          keyState: 'rotating',
          pendingKeyVersion: data.keyVersion,
          pendingRecoveryWrappedKey: data.recoveryWrappedKey,
        },
      });
      if (started.count !== 1)
        throw new ConflictError(
          'The organisation is no longer frozen, or a rotation has already been started'
        );
      await tx.orgKeyGrant.upsert({
        where: {
          organisationId_userId_keyVersion: {
            organisationId: orgId,
            userId: user.id,
            keyVersion: data.keyVersion,
          },
        },
        create: {
          organisationId: orgId,
          userId: user.id,
          grantedById: user.id,
          keyVersion: data.keyVersion,
          wrappedKey: data.grant,
          publicKey: userKey.publicKey,
        },
        update: { wrappedKey: data.grant, publicKey: userKey.publicKey },
      });
      await tx.orgKeyProof.upsert({
        where: {
          organisationId_keyVersion: { organisationId: orgId, keyVersion: data.keyVersion },
        },
        create: { organisationId: orgId, keyVersion: data.keyVersion, proof: data.proof },
        update: { proof: data.proof },
      });
      await KeyController.log(tx, orgId, OrgKeyEventType.rotationStarted, {
        actorId: user.id,
        keyVersion: data.keyVersion,
      });
    });
  }

  /**
   * The org of a bulk job and the key version the job encrypts to, after checking the org is in
   * the right state.
   */
  private static async jobOrg(
    user: FullUser,
    orgId: string,
    mode: ReencryptMode
  ): Promise<{ org: Organisation; version: number }> {
    const org = await KeyController.managedOrg(user, orgId);
    if (mode === 'rotation') {
      if (org.keyState !== 'rotating' || !org.pendingKeyVersion)
        throw new ConflictError('No rotation is running');
      return { org, version: org.pendingKeyVersion };
    }
    if (org.keyState !== 'active')
      throw new ConflictError('Migration needs an active organisation');
    return { org, version: org.keyVersion };
  }

  /** The key version a bulk job encrypts to, after checking the org is in the right state. */
  private static async jobVersion(
    user: FullUser,
    orgId: string,
    mode: ReencryptMode
  ): Promise<number> {
    return (await KeyController.jobOrg(user, orgId, mode)).version;
  }

  /** How much a rotation or migration still has to do. */
  static async getJobStatus(
    user: FullUser,
    orgId: string,
    mode: ReencryptMode
  ): Promise<MigrationStatus> {
    const version = await KeyController.jobVersion(user, orgId, mode);
    const [rows, attachmentContents] = await Promise.all([
      countPending(mode, orgId, version),
      prisma.caseAttachment.count({
        where: KeyController.attachmentContentWhere(mode, orgId, version),
      }),
    ]);
    return { rows, attachmentContents };
  }

  /** The next rows of a model a rotation or migration has to process. */
  static async getJobRows(
    user: FullUser,
    orgId: string,
    mode: ReencryptMode,
    query: ReencryptRowsQuery
  ) {
    const version = await KeyController.jobVersion(user, orgId, mode);
    return findPending(mode, query.model, orgId, version, query.take);
  }

  /** Stores a batch of re-encrypted rows. */
  static async putJobRows(
    user: FullUser,
    orgId: string,
    mode: ReencryptMode,
    data: ReencryptRowsRequest
  ) {
    const version = await KeyController.jobVersion(user, orgId, mode);
    const changed = await storeReencrypted(mode, data.model, orgId, version, data.rows);
    return { changed };
  }

  /** Attachments whose file content a job still has to process. */
  private static attachmentContentWhere(
    mode: ReencryptMode,
    orgId: string,
    version: number
  ): Prisma.CaseAttachmentWhereInput {
    return {
      AND: [
        orgScope('CaseAttachment', orgId),
        mode === 'rotation'
          ? { contentKeyVersion: { not: null }, NOT: { contentKeyVersion: version } }
          : { contentKeyVersion: null },
      ],
    };
  }

  /** Ids of the next attachments whose content a job has to process. */
  static async getJobAttachments(
    user: FullUser,
    orgId: string,
    mode: ReencryptMode,
    take = 20
  ) {
    const version = await KeyController.jobVersion(user, orgId, mode);
    return prisma.caseAttachment.findMany({
      where: KeyController.attachmentContentWhere(mode, orgId, version),
      select: { id: true, caseId: true, mimeType: true, contentKeyVersion: true },
      orderBy: { id: 'asc' },
      take,
    });
  }

  /** Loads an attachment of `orgId` for a job, or throws NotFound. */
  private static async jobAttachment(orgId: string, id: string) {
    const attachment = await prisma.caseAttachment.findFirst({
      where: { id, ...orgScope('CaseAttachment', orgId) },
    });
    if (!attachment) throw new NotFoundError();
    return attachment;
  }

  /** Path of an attachment's stored content, for streaming it to the job. */
  static async getJobAttachmentPath(
    user: FullUser,
    orgId: string,
    mode: ReencryptMode,
    id: string
  ) {
    await KeyController.jobVersion(user, orgId, mode);
    const attachment = await KeyController.jobAttachment(orgId, id);
    return resolveStoragePath(attachment.storageKey, 'case-attachments');
  }

  /**
   * Replaces an attachment's content with its re-encrypted form. The bytes must be an `FDK1`
   * envelope under the job's key version; they go to a new file, and the old one is removed only
   * after the row points at the new one.
   */
  static async putJobAttachmentContent(
    user: FullUser,
    orgId: string,
    mode: ReencryptMode,
    id: string,
    query: AttachmentContentQuery,
    body: Buffer
  ) {
    const version = await KeyController.jobVersion(user, orgId, mode);
    const attachment = await KeyController.jobAttachment(orgId, id);
    const bytes = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    if (!isBytesEnvelope(bytes) || parseBytesEnvelope(bytes).keyVersion !== version)
      throw new BadRequestError(`Content must be encrypted with key version ${version}`);
    if (query.keyVersion !== version)
      throw new BadRequestError(`keyVersion must be ${version}`);

    const storageKey = `${randomUUID()}.enc`;
    await fs.promises.writeFile(
      resolveStoragePath(storageKey, 'case-attachments'),
      bytes
    );
    await prisma.caseAttachment.update({
      where: { id },
      data: { storageKey, size: bytes.length, contentKeyVersion: version },
    });
    deleteStoredFile(attachment.storageKey, 'case-attachments');
  }

  /**
   * Ends a rotation: checks nothing is left under an old key version, stores the grants for the
   * new version, makes the recovery key stored at the start the current one, and unfreezes the
   * org. Members who receive the new version keep their old grants, which their browsers need to
   * check the continuity proof; everyone else loses theirs.
   */
  static async completeRotation(
    user: FullUser,
    orgId: string,
    data: RotationCompleteRequest
  ) {
    const { org, version } = await KeyController.jobOrg(user, orgId, 'rotation');
    if (!org.pendingRecoveryWrappedKey)
      throw new ConflictError(`Key version ${version} has no recovery key`);

    const proof = await prisma.orgKeyProof.findUnique({
      where: { organisationId_keyVersion: { organisationId: orgId, keyVersion: version } },
    });
    if (!proof) throw new ConflictError(`Key version ${version} has no continuity proof`);

    const status = await KeyController.getJobStatus(user, orgId, 'rotation');
    const left =
      Object.values(status.rows).reduce((a, b) => a + b, 0) + status.attachmentContents;
    if (left > 0)
      throw new ConflictError(`${left} values are not re-encrypted yet`);

    const recipients = await prisma.user.findMany({
      where: { id: { in: data.grants.map((g) => g.userId) }, organisationId: orgId },
      include: { userKey: true },
    });
    for (const g of data.grants) {
      const r = recipients.find((u) => u.id === g.userId);
      if (!r || !roleNeedsKeys(r.role))
        throw new BadRequestError(`User ${g.userId} can't receive a grant`);
      if (r.userKey?.publicKey !== g.publicKey)
        throw new ConflictError(`User ${g.userId} has a different key pair now`);
    }

    await prisma.$transaction(async (tx) => {
      for (const g of data.grants) {
        await tx.orgKeyGrant.upsert({
          where: {
            organisationId_userId_keyVersion: {
              organisationId: orgId,
              userId: g.userId,
              keyVersion: version,
            },
          },
          create: {
            organisationId: orgId,
            userId: g.userId,
            grantedById: user.id,
            keyVersion: version,
            wrappedKey: g.wrappedKey,
            publicKey: g.publicKey,
          },
          update: { grantedById: user.id, wrappedKey: g.wrappedKey, publicKey: g.publicKey },
        });
      }
      await tx.orgKeyGrant.deleteMany({
        where: {
          organisationId: orgId,
          keyVersion: { not: version },
          userId: { notIn: [user.id, ...data.grants.map((g) => g.userId)] },
        },
      });
      await tx.organisation.update({
        where: { id: orgId },
        data: {
          keyState: 'active',
          keyVersion: version,
          pendingKeyVersion: null,
          frozenAt: null,
          recoveryWrappedKey: org.pendingRecoveryWrappedKey,
          pendingRecoveryWrappedKey: null,
        },
      });
      await KeyController.log(tx, orgId, OrgKeyEventType.rotationCompleted, {
        actorId: user.id,
        keyVersion: version,
      });
    });
    return { keyVersion: version };
  }

  /**
   * Deletes a user's key pair and grants, as part of disabling or re-scoping them. Logged as a
   * revocation in the org they had keys for.
   */
  static async removeUserKeys(
    actor: FullUser,
    userId: string,
    organisationId: string | null,
    keepKeyPair = false
  ) {
    const { count } = await prisma.orgKeyGrant.deleteMany({ where: { userId } });
    if (!keepKeyPair) await prisma.userKey.deleteMany({ where: { userId } });
    if (organisationId && count > 0)
      await KeyController.log(prisma, organisationId, OrgKeyEventType.revoke, {
        actorId: actor.id,
        subjectId: userId,
      });
  }
}
