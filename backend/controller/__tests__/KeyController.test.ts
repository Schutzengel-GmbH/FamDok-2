jest.mock('../../db', () => ({
  prisma: require('../../testUtils/prismaMock').createPrismaMock(),
}));

import { webcrypto } from 'node:crypto';
import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import { buildUser } from '../../testUtils/fixtures';
import { KeyController, publicKeyFingerprint } from '../KeyController';
import { Role } from '../../../shared/generated/prisma/client';
import {
  GrantRequest,
  OrgSetupRequest,
  ReencryptRowsRequest,
  RotationCompleteRequest,
  RotationStartRequest,
  UserKeyRequest,
} from '../../../shared/api';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from '../../util/authUtils';
import { toB64Url } from '../../../shared/utils/ciphertext';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

const ORG = 'org-1';
const iv = 'AAECAwQFBgcICQoL';
const grant = `g1.B${'A'.repeat(86)}.${'A'.repeat(64)}`;
const recovery = (v: number) => `r1.${v}.${iv}.${'A'.repeat(64)}`;
const envelope = (v: number) => `v1.${v}.${iv}.${'A'.repeat(30)}`;
const wrappedPrivateKey = `k1.${iv}.${'A'.repeat(180)}`;
const kdfParams = {
  alg: 'argon2id',
  salt: 'AAECAwQFBgcICQoLDA0ODw',
  memoryKiB: 65536,
  iterations: 5,
  parallelism: 1,
};

/** A real P-256 public key, as a browser would upload it. */
async function publicKey(): Promise<string> {
  const pair = await webcrypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  return toB64Url(new Uint8Array(await webcrypto.subtle.exportKey('spki', pair.publicKey)));
}

const coordinator = () =>
  buildUser({ id: 'coord', role: Role.OrgCoordinator, organisationId: ORG });

beforeEach(() => {
  for (const model of Object.values(prismaMock)) {
    if (typeof model === 'object')
      Object.values(model).forEach((fn: any) => fn.mockReset?.());
  }
  prismaMock.$transaction.mockImplementation((arg: any) =>
    typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg)
  );
});

describe('KeyController', () => {
  describe('enrol', () => {
    it('stores the key pair of a user who needs keys and logs the fingerprint', async () => {
      const user = buildUser({ organisationId: ORG });
      const pk = await publicKey();
      prismaMock.userKey.findUnique.mockResolvedValue(null);
      prismaMock.userKey.upsert.mockResolvedValue({ publicKey: pk });

      const result = await KeyController.enrol(
        user,
        UserKeyRequest.parse({ publicKey: pk, wrappedPrivateKey, kdfParams })
      );

      expect(result.fingerprint).toBe(publicKeyFingerprint(pk));
      expect(result.fingerprint).toMatch(/^(\d{5} ){5}\d{5}$/);
      expect(prismaMock.orgKeyEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'enrol', subjectId: user.id }),
      });
      expect(prismaMock.orgKeyGrant.deleteMany).not.toHaveBeenCalled();
    });

    it('refuses a second key pair unless replacing, which drops the grants', async () => {
      const user = buildUser({ organisationId: ORG });
      const pk = await publicKey();
      prismaMock.userKey.findUnique.mockResolvedValue({ userId: user.id });
      prismaMock.userKey.upsert.mockResolvedValue({ publicKey: pk });

      await expect(
        KeyController.enrol(user, UserKeyRequest.parse({ publicKey: pk, wrappedPrivateKey, kdfParams }))
      ).rejects.toThrow(ConflictError);

      await KeyController.enrol(
        user,
        UserKeyRequest.parse({ publicKey: pk, wrappedPrivateKey, kdfParams, replace: true })
      );
      expect(prismaMock.orgKeyGrant.deleteMany).toHaveBeenCalledWith({
        where: { userId: user.id },
      });
      expect(prismaMock.orgKeyEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'reenrol' }),
      });
    });

    it('refuses roles that never read personal data', async () => {
      const controller = buildUser({ role: Role.Controller, organisationId: null });
      await expect(
        KeyController.enrol(
          controller,
          UserKeyRequest.parse({ publicKey: await publicKey(), wrappedPrivateKey, kdfParams })
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('rejects anything that is not a P-256 public key', () => {
      expect(() =>
        UserKeyRequest.parse({ publicKey: 'A'.repeat(122), wrappedPrivateKey, kdfParams })
      ).toThrow();
      expect(() =>
        UserKeyRequest.parse({
          publicKey: 'x',
          wrappedPrivateKey: 'plaintext',
          kdfParams: { ...kdfParams, iterations: 0 },
        })
      ).toThrow();
    });
  });

  describe('setupOrg', () => {
    it('activates an uninitialized org with the self-grant and recovery key', async () => {
      const pk = await publicKey();
      prismaMock.organisation.findUnique.mockResolvedValue({ id: ORG, keyState: 'uninitialized' });
      prismaMock.userKey.findUnique.mockResolvedValue({ publicKey: pk });
      prismaMock.organisation.updateMany.mockResolvedValue({ count: 1 });

      await KeyController.setupOrg(
        coordinator(),
        ORG,
        OrgSetupRequest.parse({ grant, recoveryWrappedKey: recovery(1) })
      );

      expect(prismaMock.organisation.updateMany).toHaveBeenCalledWith({
        where: { id: ORG, keyState: 'uninitialized' },
        data: { keyState: 'active', keyVersion: 1, recoveryWrappedKey: recovery(1) },
      });
      expect(prismaMock.orgKeyGrant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'coord', keyVersion: 1, wrappedKey: grant, publicKey: pk }),
      });
    });

    it('never sets up an org twice', async () => {
      prismaMock.organisation.findUnique.mockResolvedValue({ id: ORG, keyState: 'active' });
      prismaMock.userKey.findUnique.mockResolvedValue({ publicKey: await publicKey() });
      prismaMock.organisation.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        KeyController.setupOrg(coordinator(), ORG, OrgSetupRequest.parse({ grant, recoveryWrappedKey: recovery(1) }))
      ).rejects.toThrow(ConflictError);
      expect(prismaMock.orgKeyGrant.create).not.toHaveBeenCalled();
    });

    it('is only open to coordinators of that org', async () => {
      const otherCoordinator = buildUser({ role: Role.OrgCoordinator, organisationId: 'org-2' });
      const admin = buildUser({ role: Role.Admin, organisationId: null });
      for (const user of [otherCoordinator, admin, buildUser({ organisationId: ORG })]) {
        await expect(
          KeyController.setupOrg(user, ORG, OrgSetupRequest.parse({ grant, recoveryWrappedKey: recovery(1) }))
        ).rejects.toThrow(ForbiddenError);
      }
    });
  });

  describe('grant', () => {
    let pk: string;
    beforeEach(async () => {
      pk = await publicKey();
      prismaMock.organisation.findUnique.mockResolvedValue({ id: ORG, keyState: 'active', keyVersion: 2 });
      prismaMock.orgKeyGrant.upsert.mockResolvedValue({ id: 'g' });
    });

    it('stores a grant for a member with the key pair it was sealed to', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u', organisationId: ORG, role: Role.User, userKey: { publicKey: pk },
      });
      await KeyController.grant(coordinator(), ORG, GrantRequest.parse({ userId: 'u', keyVersion: 2, wrappedKey: grant, publicKey: pk }));
      expect(prismaMock.orgKeyGrant.upsert).toHaveBeenCalled();
      expect(prismaMock.orgKeyEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'grant', subjectId: 'u', keyVersion: 2, fingerprint: publicKeyFingerprint(pk) }),
      });
    });

    it('refuses a grant for an outdated key version', async () => {
      await expect(
        KeyController.grant(coordinator(), ORG, GrantRequest.parse({ userId: 'u', keyVersion: 1, wrappedKey: grant, publicKey: pk }))
      ).rejects.toThrow(BadRequestError);
    });

    it('refuses a grant sealed to a key pair the user has since replaced', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u', organisationId: ORG, role: Role.User, userKey: { publicKey: await publicKey() },
      });
      await expect(
        KeyController.grant(coordinator(), ORG, GrantRequest.parse({ userId: 'u', keyVersion: 2, wrappedKey: grant, publicKey: pk }))
      ).rejects.toThrow(ConflictError);
    });

    it('refuses members of other orgs and roles without keys', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'u', organisationId: 'org-2', role: Role.User, userKey: { publicKey: pk },
      });
      await expect(
        KeyController.grant(coordinator(), ORG, GrantRequest.parse({ userId: 'u', keyVersion: 2, wrappedKey: grant, publicKey: pk }))
      ).rejects.toThrow();
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'u', organisationId: ORG, role: Role.Controller, userKey: { publicKey: pk },
      });
      await expect(
        KeyController.grant(coordinator(), ORG, GrantRequest.parse({ userId: 'u', keyVersion: 2, wrappedKey: grant, publicKey: pk }))
      ).rejects.toThrow(BadRequestError);
    });

    it('is open to OrgControllers of the org, who may also receive grants', async () => {
      const orgController = buildUser({ id: 'oc', role: Role.OrgController, organisationId: ORG });
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'oc2', organisationId: ORG, role: Role.OrgController, userKey: { publicKey: pk },
      });
      await KeyController.grant(orgController, ORG, GrantRequest.parse({ userId: 'oc2', keyVersion: 2, wrappedKey: grant, publicKey: pk }));
      expect(prismaMock.orgKeyGrant.upsert).toHaveBeenCalled();
      await expect(
        KeyController.grant(buildUser({ role: Role.OrgController, organisationId: 'org-2' }), ORG, GrantRequest.parse({ userId: 'oc2', keyVersion: 2, wrappedKey: grant, publicKey: pk }))
      ).rejects.toThrow(ForbiddenError);
    });

    it('is not open to the Admin', async () => {
      await expect(
        KeyController.grant(buildUser({ role: Role.Admin, organisationId: null }), ORG, GrantRequest.parse({ userId: 'u', keyVersion: 2, wrappedKey: grant, publicKey: pk }))
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('freeze', () => {
    it('lets coordinators and the Admin freeze, nobody else', async () => {
      prismaMock.organisation.updateMany.mockResolvedValue({ count: 1 });
      await KeyController.freeze(coordinator(), ORG);
      await KeyController.freeze(buildUser({ role: Role.Admin, organisationId: null }), ORG);
      await expect(KeyController.freeze(buildUser({ organisationId: ORG }), ORG)).rejects.toThrow(ForbiddenError);
      expect(prismaMock.organisation.updateMany).toHaveBeenCalledWith({
        where: { id: ORG, keyState: 'active' },
        data: { keyState: 'frozen', frozenAt: expect.any(Date) },
      });
    });

    it('does not unfreeze a rotating org', async () => {
      prismaMock.organisation.updateMany.mockResolvedValue({ count: 0 });
      await expect(KeyController.unfreeze(coordinator(), ORG)).rejects.toThrow(ConflictError);
      expect(prismaMock.organisation.updateMany).toHaveBeenCalledWith({
        where: { id: ORG, keyState: 'frozen' },
        data: { keyState: 'active', frozenAt: null },
      });
    });
  });

  describe('rotation', () => {
    const rotating = {
      id: ORG, keyState: 'rotating', keyVersion: 1, pendingKeyVersion: 2,
      recoveryWrappedKey: recovery(1), pendingRecoveryWrappedKey: recovery(2),
    };
    const start = (keyVersion: number, proof = envelope(1), recoveryWrappedKey = recovery(keyVersion)) =>
      RotationStartRequest.parse({ keyVersion, grant, proof, recoveryWrappedKey });

    function noRowsLeft() {
      for (const m of ['family', 'child', 'caregiver', 'case', 'contactDocumentation', 'zielvereinbarung', 'handover', 'caseAttachment', 'answer'])
        (prismaMock as any)[m].count.mockResolvedValue(0);
    }

    it('starts only on a frozen org with the next version, storing the new recovery key', async () => {
      prismaMock.organisation.findUnique.mockResolvedValue({ id: ORG, keyState: 'active', keyVersion: 1 });
      await expect(KeyController.startRotation(coordinator(), ORG, start(2))).rejects.toThrow(ConflictError);

      prismaMock.organisation.findUnique.mockResolvedValue({ id: ORG, keyState: 'frozen', keyVersion: 1 });
      await expect(KeyController.startRotation(coordinator(), ORG, start(3))).rejects.toThrow(BadRequestError);

      prismaMock.userKey.findUnique.mockResolvedValue({ publicKey: await publicKey() });
      prismaMock.organisation.updateMany.mockResolvedValue({ count: 1 });
      await KeyController.startRotation(coordinator(), ORG, start(2));
      expect(prismaMock.organisation.updateMany).toHaveBeenCalledWith({
        where: { id: ORG, keyState: 'frozen', keyVersion: 1 },
        data: { keyState: 'rotating', pendingKeyVersion: 2, pendingRecoveryWrappedKey: recovery(2) },
      });
      expect(prismaMock.orgKeyProof.upsert).toHaveBeenCalledWith({
        where: { organisationId_keyVersion: { organisationId: ORG, keyVersion: 2 } },
        create: { organisationId: ORG, keyVersion: 2, proof: envelope(1) },
        update: { proof: envelope(1) },
      });
    });

    it('changes nothing when a concurrent start won the race', async () => {
      prismaMock.organisation.findUnique.mockResolvedValue({ id: ORG, keyState: 'frozen', keyVersion: 1 });
      prismaMock.userKey.findUnique.mockResolvedValue({ publicKey: await publicKey() });
      prismaMock.organisation.updateMany.mockResolvedValue({ count: 0 });
      await expect(KeyController.startRotation(coordinator(), ORG, start(2))).rejects.toThrow(ConflictError);
      expect(prismaMock.orgKeyGrant.upsert).not.toHaveBeenCalled();
      expect(prismaMock.orgKeyProof.upsert).not.toHaveBeenCalled();
    });

    it('needs a continuity proof encrypted under the current version', async () => {
      prismaMock.organisation.findUnique.mockResolvedValue({ id: ORG, keyState: 'frozen', keyVersion: 1 });
      prismaMock.userKey.findUnique.mockResolvedValue({ publicKey: await publicKey() });
      await expect(
        KeyController.startRotation(coordinator(), ORG, start(2, envelope(2)))
      ).rejects.toThrow(BadRequestError);
      expect(() => RotationStartRequest.parse({ keyVersion: 2, grant, recoveryWrappedKey: recovery(2) })).toThrow();
      expect(prismaMock.orgKeyProof.upsert).not.toHaveBeenCalled();
    });

    it('needs the new recovery key, for the new version', async () => {
      prismaMock.organisation.findUnique.mockResolvedValue({ id: ORG, keyState: 'frozen', keyVersion: 1 });
      prismaMock.userKey.findUnique.mockResolvedValue({ publicKey: await publicKey() });
      expect(() => RotationStartRequest.parse({ keyVersion: 2, grant, proof: envelope(1) })).toThrow();
      await expect(
        KeyController.startRotation(coordinator(), ORG, start(2, envelope(1), recovery(1)))
      ).rejects.toThrow(BadRequestError);
      expect(prismaMock.organisation.updateMany).not.toHaveBeenCalled();
    });

    it('accepts grants for the current and the pending version while rotating', async () => {
      const pk = await publicKey();
      prismaMock.organisation.findUnique.mockResolvedValue(rotating);
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'coord', organisationId: ORG, role: Role.OrgCoordinator, userKey: { publicKey: pk },
      });
      prismaMock.orgKeyGrant.upsert.mockResolvedValue({ id: 'g' });
      for (const keyVersion of [1, 2])
        await KeyController.grant(coordinator(), ORG, GrantRequest.parse({ userId: 'coord', keyVersion, wrappedKey: grant, publicKey: pk }));
      expect(prismaMock.orgKeyGrant.upsert).toHaveBeenCalledTimes(2);
      await expect(
        KeyController.grant(coordinator(), ORG, GrantRequest.parse({ userId: 'coord', keyVersion: 3, wrappedKey: grant, publicKey: pk }))
      ).rejects.toThrow(BadRequestError);
    });

    it('hands out the recovery keys of the current and the pending version while rotating', async () => {
      prismaMock.organisation.findUnique.mockResolvedValue(rotating);
      expect(await KeyController.getRecovery(coordinator(), ORG)).toEqual([
        { keyVersion: 1, recoveryWrappedKey: recovery(1) },
        { keyVersion: 2, recoveryWrappedKey: recovery(2) },
      ]);
      prismaMock.organisation.findUnique.mockResolvedValue({
        id: ORG, keyState: 'active', keyVersion: 2, pendingKeyVersion: null,
        recoveryWrappedKey: recovery(2), pendingRecoveryWrappedKey: null,
      });
      expect(await KeyController.getRecovery(coordinator(), ORG)).toEqual([
        { keyVersion: 2, recoveryWrappedKey: recovery(2) },
      ]);
    });

    it('does not complete a version without a continuity proof', async () => {
      prismaMock.organisation.findUnique.mockResolvedValue(rotating);
      noRowsLeft();
      prismaMock.orgKeyProof.findUnique.mockResolvedValue(null);
      await expect(
        KeyController.completeRotation(coordinator(), ORG, RotationCompleteRequest.parse({ grants: [] }))
      ).rejects.toThrow(ConflictError);
      expect(prismaMock.organisation.update).not.toHaveBeenCalled();
    });

    it('only stores ciphertext under the pending version, in encrypted columns', async () => {
      prismaMock.organisation.findUnique.mockResolvedValue(rotating);
      prismaMock.contactDocumentation.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        KeyController.putJobRows(coordinator(), ORG, 'rotation', ReencryptRowsRequest.parse({
          model: 'ContactDocumentation', rows: [{ id: 'd', values: { dokumentation: envelope(1) } }],
        }))
      ).rejects.toThrow(BadRequestError);
      await expect(
        KeyController.putJobRows(coordinator(), ORG, 'rotation', ReencryptRowsRequest.parse({
          model: 'ContactDocumentation', rows: [{ id: 'd', values: { caseId: envelope(2) } }],
        }))
      ).rejects.toThrow(BadRequestError);

      const result = await KeyController.putJobRows(coordinator(), ORG, 'rotation', ReencryptRowsRequest.parse({
        model: 'ContactDocumentation', rows: [{ id: 'd', values: { dokumentation: envelope(2), zusammenfassung: null } }],
      }));
      expect(result.changed).toBe(1);
      const call = prismaMock.contactDocumentation.updateMany.mock.calls[0][0];
      expect(call.data).toEqual({ dokumentation: envelope(2), zusammenfassung: null });
      expect(JSON.stringify(call.where)).toContain(`"organisationId":"${ORG}"`);
    });

    it('refuses plaintext in the row schema', () => {
      expect(() =>
        ReencryptRowsRequest.parse({ model: 'Family', rows: [{ id: 'f', values: { encrypted: 'Familie Muster' } }] })
      ).toThrow();
    });

    it('does not complete while values under the old version remain', async () => {
      prismaMock.organisation.findUnique.mockResolvedValue(rotating);
      prismaMock.orgKeyProof.findUnique.mockResolvedValue({ keyVersion: 2, proof: envelope(1) });
      noRowsLeft();
      prismaMock.answer.count.mockResolvedValue(3);
      await expect(
        KeyController.completeRotation(coordinator(), ORG, RotationCompleteRequest.parse({ grants: [] }))
      ).rejects.toThrow(ConflictError);
    });

    it('completes: new grants, old grants kept only for re-granted members, org active on the new version', async () => {
      const pk = await publicKey();
      prismaMock.organisation.findUnique.mockResolvedValue(rotating);
      prismaMock.orgKeyProof.findUnique.mockResolvedValue({ keyVersion: 2, proof: envelope(1) });
      noRowsLeft();
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'u', organisationId: ORG, role: Role.User, userKey: { publicKey: pk } },
      ]);

      await KeyController.completeRotation(coordinator(), ORG, RotationCompleteRequest.parse({
        grants: [{ userId: 'u', wrappedKey: grant, publicKey: pk }],
      }));

      expect(prismaMock.orgKeyGrant.upsert).toHaveBeenCalledTimes(1);
      expect(prismaMock.orgKeyGrant.deleteMany).toHaveBeenCalledWith({
        where: { organisationId: ORG, keyVersion: { not: 2 }, userId: { notIn: ['coord', 'u'] } },
      });
      expect(prismaMock.organisation.update).toHaveBeenCalledWith({
        where: { id: ORG },
        data: {
          keyState: 'active', keyVersion: 2, pendingKeyVersion: null, frozenAt: null,
          recoveryWrappedKey: recovery(2), pendingRecoveryWrappedKey: null,
        },
      });
    });

    it("returns all of the user's grants and the continuity proofs in the status", async () => {
      prismaMock.organisation.findUnique.mockResolvedValue({ id: ORG, name: 'O', keyState: 'active', keyVersion: 2, pendingKeyVersion: null, frozenAt: null });
      prismaMock.userKey.findUnique.mockResolvedValue(null);
      prismaMock.orgKeyGrant.findMany.mockResolvedValue([{ keyVersion: 1 }, { keyVersion: 2 }]);
      prismaMock.orgKeyProof.findMany.mockResolvedValue([{ keyVersion: 2, proof: envelope(1) }]);
      const status = await KeyController.getStatus(coordinator());
      expect(prismaMock.orgKeyGrant.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { organisationId: ORG, userId: 'coord' },
      }));
      expect(status.grants).toHaveLength(2);
      expect(status.keyProofs).toEqual([{ keyVersion: 2, proof: envelope(1) }]);
    });

    it('does not complete without the recovery key stored at the start', async () => {
      prismaMock.organisation.findUnique.mockResolvedValue({ ...rotating, pendingRecoveryWrappedKey: null });
      prismaMock.orgKeyProof.findUnique.mockResolvedValue({ keyVersion: 2, proof: envelope(1) });
      noRowsLeft();
      await expect(
        KeyController.completeRotation(coordinator(), ORG, RotationCompleteRequest.parse({ grants: [] }))
      ).rejects.toThrow(ConflictError);
      expect(prismaMock.organisation.update).not.toHaveBeenCalled();
      expect(() => RotationCompleteRequest.parse({ grants: [], recoveryWrappedKey: recovery(2) })).toThrow();
    });

    it('refuses to store a key pair wrapped under parameters below the minimum', async () => {
      const pk = await publicKey();
      expect(() => UserKeyRequest.parse({ publicKey: pk, wrappedPrivateKey, kdfParams })).not.toThrow();
      expect(() => UserKeyRequest.parse({
        publicKey: pk, wrappedPrivateKey, kdfParams: { ...kdfParams, memoryKiB: 19_455 },
      })).toThrow();
      expect(() => UserKeyRequest.parse({
        publicKey: pk, wrappedPrivateKey, kdfParams: { ...kdfParams, iterations: 1 },
      })).toThrow();
    });
  });

  describe('migration', () => {
    it('clears the plaintext columns when storing a family blob', async () => {
      prismaMock.organisation.findUnique.mockResolvedValue({ id: ORG, keyState: 'active', keyVersion: 1 });
      prismaMock.family.updateMany.mockResolvedValue({ count: 1 });

      await KeyController.putJobRows(coordinator(), ORG, 'migration', ReencryptRowsRequest.parse({
        model: 'Family', rows: [{ id: 'f', values: { encrypted: envelope(1) } }],
      }));

      expect(prismaMock.family.updateMany.mock.calls[0][0].data).toEqual({
        encrypted: envelope(1), name: null, note: null, adress: null, phone: null, additionalPhones: [],
      });
    });

    it('needs an active org', async () => {
      prismaMock.organisation.findUnique.mockResolvedValue({ id: ORG, keyState: 'uninitialized', keyVersion: 0 });
      await expect(KeyController.getJobStatus(coordinator(), ORG, 'migration')).rejects.toThrow(ConflictError);
    });
  });
});
