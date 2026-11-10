import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type { KeyStatus } from '../../../../shared/api';
import { KeySessionService } from './key-session.service';
import { KeyApiService } from './key-api.service';
import { KdfService } from './kdf.service';
import { MeService } from './me.service';
import { CryptoService } from './crypto.service';
import { deriveKek, KdfParams } from '../util/crypto/kdf';
import { WrongPassphraseError, WrongRecoveryCodeError } from '../util/crypto/errors';
import { isP256PublicKey, isWrappedPrivKey } from '../../../../shared/utils/ciphertext';

const ORG = 'org-1';

/** Cheap KDF for tests: same derivation on wrap and unwrap, just far fewer resources. */
class FastKdf {
  deriveKek(passphrase: string, params: KdfParams) {
    return deriveKek(passphrase, { ...params, memoryKiB: 64, iterations: 1 });
  }
}

/** An in-memory `/keys` backend for one user, enough for the session flows. */
class FakeKeyApi {
  status: KeyStatus = {
    enabled: true,
    org: {
      id: ORG,
      name: 'Org',
      keyState: 'active',
      keyVersion: 1,
      pendingKeyVersion: null,
      frozenAt: null,
    },
    userKey: null,
    grants: [],
    keyProofs: [],
    canManageKeys: false,
    needsKeys: true,
  };
  recoveryWrappedKey = '';
  pendingRecoveryWrappedKey = '';

  getStatus = jasmine.createSpy('getStatus').and.callFake(async () => structuredClone(this.status));
  enrol = jasmine.createSpy('enrol').and.callFake(async (body: any) => {
    this.status.userKey = {
      publicKey: body.publicKey,
      wrappedPrivateKey: body.wrappedPrivateKey,
      kdfParams: body.kdfParams,
    };
    this.status.grants = [];
    return { publicKey: body.publicKey, fingerprint: '' };
  });
  changePassphrase = jasmine.createSpy('changePassphrase').and.callFake(async (body: any) => {
    this.status.userKey = { ...this.status.userKey!, ...body };
  });
  setupOrg = jasmine.createSpy('setupOrg').and.callFake(async (_orgId: string, body: any) => {
    this.status.org = { ...this.status.org!, keyState: 'active', keyVersion: 1 };
    this.status.grants = [
      { keyVersion: 1, wrappedKey: body.grant, publicKey: this.status.userKey!.publicKey },
    ];
    this.recoveryWrappedKey = body.recoveryWrappedKey;
  });
  grant = jasmine.createSpy('grant').and.callFake(async (_orgId: string, body: any) => {
    this.status.grants = [
      ...this.status.grants.filter((g) => g.keyVersion !== body.keyVersion),
      { keyVersion: body.keyVersion, wrappedKey: body.wrappedKey, publicKey: body.publicKey },
    ];
  });
  getRecovery = jasmine.createSpy('getRecovery').and.callFake(async () => {
    const org = this.status.org!;
    return [
      { keyVersion: org.keyVersion, recoveryWrappedKey: this.recoveryWrappedKey },
      ...(org.keyState === 'rotating' && org.pendingKeyVersion
        ? [{ keyVersion: org.pendingKeyVersion, recoveryWrappedKey: this.pendingRecoveryWrappedKey }]
        : []),
    ];
  });
}

describe('KeySessionService', () => {
  let api: FakeKeyApi;
  let session: KeySessionService;
  let crypto: CryptoService;

  function create() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: KeyApiService, useValue: api },
        { provide: KdfService, useClass: FastKdf },
        { provide: MeService, useValue: { getMe: () => of({ id: 'user-1' }) } },
      ],
    });
    session = TestBed.inject(KeySessionService);
    crypto = TestBed.inject(CryptoService);
  }

  /** Lets a "coordinator" grant the given key to the user's uploaded public key. */
  async function grantTo(dek: CryptoKey, keyVersion = 1) {
    const pub = await crypto.importPublicKey(api.status.userKey!.publicKey);
    api.status.grants = [
      {
        keyVersion,
        wrappedKey: await crypto.sealGrant(dek, pub, { orgId: ORG, keyVersion }),
        publicKey: api.status.userKey!.publicKey,
      },
    ];
  }

  /**
   * A rotation to `keyVersion`: the user keeps the old grant and gets one for `dek`. With
   * `proofKey` (the previous version's key) the continuity proof is real; the operator can only
   * offer none, or one made with a key of its own.
   */
  async function rotateTo(dek: CryptoKey, keyVersion: number, proofKey?: CryptoKey) {
    const pub = await crypto.importPublicKey(api.status.userKey!.publicKey);
    const ctx = { orgId: ORG, keyVersion };
    api.status.org = { ...api.status.org!, keyVersion };
    api.status.grants.push({
      keyVersion,
      wrappedKey: await crypto.sealGrant(dek, pub, ctx),
      publicKey: api.status.userKey!.publicKey,
    });
    if (proofKey)
      api.status.keyProofs.push({
        keyVersion,
        proof: await crypto.sealKeyProof(
          await crypto.fingerprintDataKey(dek),
          { version: keyVersion - 1, key: proofKey },
          ctx,
        ),
      });
  }

  beforeEach(() => {
    localStorage.clear();
    api = new FakeKeyApi();
    create();
  });

  afterEach(() => localStorage.clear());

  it('asks a new user to enrol, then waits for a grant', async () => {
    await session.ensureLoaded();
    expect(session.state()).toBe('needsEnrolment');

    const fingerprint = await session.enrol('eine sehr gute Passphrase');

    const body = api.enrol.calls.mostRecent().args[0];
    expect(isP256PublicKey(body.publicKey)).toBeTrue();
    expect(isWrappedPrivKey(body.wrappedPrivateKey)).toBeTrue();
    expect(body.replace).toBeFalse();
    expect(fingerprint).toBe(await crypto.publicKeyFingerprint(body.publicKey));
    expect(session.state()).toBe('awaitingGrant');
  });

  it('unlocks with the passphrase once granted, and encrypts with the granted key', async () => {
    await session.enrol('eine sehr gute Passphrase');
    const dek = await crypto.generateDataKey();
    await grantTo(dek);

    create();
    await session.ensureLoaded();
    expect(session.state()).toBe('locked');

    await session.unlock('eine sehr gute Passphrase');
    expect(session.state()).toBe('unlocked');

    const ctx = { table: 'Family', rowId: 'f1', field: 'encrypted' };
    const envelope = await crypto.encryptField('Muster', session.currentKey(), ctx);
    expect(await crypto.decryptField(envelope, () => dek, ctx)).toBe('Muster');
    expect(session.keyResolver(1)).toBeDefined();
  });

  it('refuses a wrong passphrase and stays locked', async () => {
    await session.enrol('eine sehr gute Passphrase');
    create();
    await session.ensureLoaded();
    await expectAsync(session.unlock('falsch')).toBeRejectedWithError(WrongPassphraseError);
    expect(session.state()).toBe('locked');
  });

  it('forgets the keys when locked', async () => {
    await session.enrol('eine sehr gute Passphrase');
    await grantTo(await crypto.generateDataKey());
    await session.refresh();
    expect(session.state()).toBe('unlocked');

    session.lock();

    expect(session.state()).toBe('locked');
    expect(session.keyResolver(1)).toBeUndefined();
    expect(() => session.currentKey()).toThrow();
  });

  it('changes the passphrase without changing the key pair', async () => {
    await session.enrol('eine sehr gute Passphrase');
    const publicKey = api.status.userKey!.publicKey;
    await session.changePassphrase('eine sehr gute Passphrase', 'eine andere gute Passphrase');
    expect(api.status.userKey!.publicKey).toBe(publicKey);

    create();
    await expectAsync(session.unlock('eine sehr gute Passphrase')).toBeRejectedWithError(
      WrongPassphraseError,
    );
    await expectAsync(session.unlock('eine andere gute Passphrase')).toBeResolved();
  });

  it('is disabled, with nothing to encrypt, while the server runs without encryption', async () => {
    api.status.enabled = false;
    api.status.org = { ...api.status.org!, keyState: 'uninitialized', keyVersion: 0 };
    await session.ensureLoaded();
    expect(session.state()).toBe('disabled');
    expect(session.encryptionEnabled()).toBeFalse();
    expect(session.encryptionActive()).toBeFalse();
  });

  it('does not believe a server that switches the encryption off after this browser saw it on', async () => {
    await session.enrol('eine sehr gute Passphrase');
    await grantTo(await crypto.generateDataKey());
    await session.refresh();
    expect(session.state()).toBe('unlocked');

    api.status.enabled = false;
    create();
    await session.ensureLoaded();
    expect(session.state()).toBe('keyMismatch');
    expect(session.encryptionActive()).toBeFalse();
  });

  it('sets up an org: the self-grant opens, the recovery code restores access', async () => {
    api.status.org = { ...api.status.org!, keyState: 'uninitialized', keyVersion: 0 };
    api.status.canManageKeys = true;
    await session.ensureLoaded();
    expect(session.state()).toBe('orgNotSetUp');

    await session.enrol('Koordination ist wichtig');
    const { recoveryCode, commit } = await session.prepareOrgSetup();
    expect(api.setupOrg).not.toHaveBeenCalled();
    await commit();
    expect(session.state()).toBe('unlocked');
    const fingerprint = session.orgKeyFingerprint();

    // the coordinator forgets the passphrase, re-enrols and recovers
    create();
    localStorage.clear();
    await session.enrol('ein ganz neuer Anfang');
    expect(session.state()).toBe('awaitingGrant');
    await session.recover(recoveryCode);
    expect(session.state()).toBe('unlocked');
    expect(session.orgKeyFingerprint()).toBe(fingerprint);
  });

  it('resumes a rotation whose key manager lost access, with the old and the new recovery code', async () => {
    api.status.org = { ...api.status.org!, keyState: 'uninitialized', keyVersion: 0 };
    api.status.canManageKeys = true;
    await session.ensureLoaded();
    await session.enrol('Koordination ist wichtig');
    const { recoveryCode: oldCode, commit } = await session.prepareOrgSetup();
    await commit();
    const v1 = session.currentKey();

    // the rotation started: new key v2, its proof under v1, and its recovery-wrapped key
    const v2 = await crypto.generateDataKey();
    const ctx = { orgId: ORG, keyVersion: 2 };
    const newCode = crypto.generateRecoveryCode();
    api.status.org = { ...api.status.org!, keyState: 'rotating', pendingKeyVersion: 2 };
    api.status.keyProofs = [
      { keyVersion: 2, proof: await crypto.sealKeyProof(await crypto.fingerprintDataKey(v2), v1, ctx) },
    ];
    api.pendingRecoveryWrappedKey = await crypto.sealRecovery(v2, newCode, ctx);

    // the key manager re-enrols, which drops all their grants, and recovers both keys
    create();
    await session.enrol('ein ganz neuer Anfang');
    expect(session.keyResolver(1)).toBeUndefined();
    await expectAsync(session.recover(crypto.generateRecoveryCode())).toBeRejectedWithError(
      WrongRecoveryCodeError,
    );
    expect(await session.recover(newCode)).toBe(2);
    expect(await session.recover(oldCode)).toBe(1);
    expect(session.state()).toBe('unlocked');
    expect(session.keyResolver(1)).toBeDefined();
    expect(session.keyResolver(2)).toBeDefined();
  });

  it('detects a swapped key under the same version', async () => {
    await session.enrol('eine sehr gute Passphrase');
    await grantTo(await crypto.generateDataKey());
    await session.refresh();
    expect(session.state()).toBe('unlocked');

    await grantTo(await crypto.generateDataKey());
    create();
    await session.unlock('eine sehr gute Passphrase');
    expect(session.state()).toBe('keyMismatch');
    expect(() => session.currentKey()).toThrow();
  });

  it('accepts a newer key version with a valid continuity proof and says so', async () => {
    await session.enrol('eine sehr gute Passphrase');
    const v1 = await crypto.generateDataKey();
    await grantTo(v1);
    await session.refresh();

    await rotateTo(await crypto.generateDataKey(), 2, v1);
    create();
    await session.unlock('eine sehr gute Passphrase');
    expect(session.state()).toBe('unlocked');
    expect(session.currentKey().version).toBe(2);
    expect(session.rotationNotice()).toEqual({ from: 1, to: 2 });
  });

  it('follows the proofs on a browser without a pin, too', async () => {
    await session.enrol('eine sehr gute Passphrase');
    const v1 = await crypto.generateDataKey();
    await grantTo(v1);
    await rotateTo(await crypto.generateDataKey(), 2, v1);
    localStorage.clear();

    create();
    await session.unlock('eine sehr gute Passphrase');
    expect(session.state()).toBe('unlocked');
    expect(session.currentKey().version).toBe(2);
  });

  it('refuses a rotation forged by the operator, with or without a fake proof', async () => {
    await session.enrol('eine sehr gute Passphrase');
    await grantTo(await crypto.generateDataKey());
    const enrolled = structuredClone(api.status);

    for (const operatorKey of [undefined, await crypto.generateDataKey()]) {
      for (const pinned of [true, false]) {
        api.status = structuredClone(enrolled);
        localStorage.clear();
        if (pinned) {
          create();
          await session.unlock('eine sehr gute Passphrase');
          expect(session.state()).toBe('unlocked');
        }

        // a forged version 2 sealed to the user's public key, without the old key
        await rotateTo(await crypto.generateDataKey(), 2, operatorKey);
        create();
        await session.unlock('eine sehr gute Passphrase');

        expect(session.state()).toBe('keyMismatch');
        expect(session.keyResolver(1)).toBeUndefined();
        expect(session.keyResolver(2)).toBeUndefined();
        expect(() => session.currentKey()).toThrow();
        expect(session.presentedKey()?.keyVersion).toBe(2);
      }
    }
  });

  it('ignores a pending version without a proof but keeps working on the current one', async () => {
    await session.enrol('eine sehr gute Passphrase');
    const v1 = await crypto.generateDataKey();
    await grantTo(v1);
    await rotateTo(await crypto.generateDataKey(), 2);
    api.status.org = { ...api.status.org!, keyVersion: 1, pendingKeyVersion: 2 };

    await session.refresh();
    expect(session.state()).toBe('unlocked');
    expect(session.keyResolver(1)).toBeDefined();
    expect(session.keyResolver(2)).toBeUndefined();
  });

  it('lets a user who lost the pinned version accept the new key after comparing it', async () => {
    await session.enrol('eine sehr gute Passphrase');
    await grantTo(await crypto.generateDataKey());
    await session.refresh();

    // forgot the passphrase: new key pair, the grants are gone; then granted version 2
    create();
    await session.enrol('ein neuer Anfang');
    api.status.org = { ...api.status.org!, keyVersion: 2 };
    await grantTo(await crypto.generateDataKey(), 2);
    await session.refresh();

    expect(session.state()).toBe('keyMismatch');
    const presented = session.presentedKey()!;
    await session.acceptPresentedKey();
    expect(session.state()).toBe('unlocked');
    expect(session.orgKeyFingerprint()).toBe(presented.fingerprint);
  });

  it('refuses a server that claims an encrypted org is not encrypted', async () => {
    await session.enrol('eine sehr gute Passphrase');
    await grantTo(await crypto.generateDataKey());
    await session.refresh();

    api.status.org = { ...api.status.org!, keyState: 'uninitialized', keyVersion: 0 };
    create();
    await session.ensureLoaded();
    expect(session.state()).toBe('keyMismatch');
    expect(session.encryptionActive()).toBeFalse();
  });

  it('needs no keys for roles without personal data, and is frozen for members of frozen orgs', async () => {
    api.status.needsKeys = false;
    await session.ensureLoaded();
    expect(session.state()).toBe('notNeeded');

    api.status.needsKeys = true;
    api.status.org = { ...api.status.org!, keyState: 'frozen' };
    await session.refresh();
    expect(session.state()).toBe('frozen');

    api.status.canManageKeys = true;
    await session.refresh();
    expect(session.state()).toBe('needsEnrolment');
  });
});

describe('KdfService', () => {
  it('derives in the worker the same key as on the main thread', async () => {
    const service = TestBed.inject(KdfService);
    const crypto = TestBed.inject(CryptoService);
    const params: KdfParams = {
      alg: 'argon2id',
      salt: 'AAECAwQFBgcICQoLDA0ODw',
      memoryKiB: 1024,
      iterations: 2,
      parallelism: 1,
    };
    const pair = await crypto.generateUserKeyPair();
    const fromWorker = await service.deriveKek('Grüße aus Flensburg', params);
    const onMain = await deriveKek('Grüße aus Flensburg', params);

    const wrapped = await crypto.wrapPrivateKey(pair.privateKey, fromWorker, 'u');
    await expectAsync(crypto.unwrapPrivateKey(wrapped, onMain, 'u')).toBeResolved();
  }, 30000);
});
