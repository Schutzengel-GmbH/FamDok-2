import { TestBed } from '@angular/core/testing';
import { CryptoService } from '../../services/crypto.service';
import { deriveKek, KdfParams, newKdfParams } from './kdf';
import { WrongPassphraseError } from './errors';

/**
 * The whole key protocol against an in-memory "server" that only ever stores what the real
 * backend stores: public keys, wrapped private keys, KDF params, grants, the recovery-wrapped key
 * and ciphertext. Every step a browser takes goes through CryptoService.
 */
describe('org encryption protocol', () => {
  let crypto: CryptoService;

  const orgId = 'org-1';
  const server = {
    userKeys: new Map<string, { publicKey: string; wrappedPrivateKey: string; kdf: KdfParams }>(),
    grants: new Map<string, string>(),
    recoveryWrappedKey: '',
    keyVersion: 0,
    rows: new Map<string, string>(),
  };

  beforeEach(() => {
    crypto = TestBed.inject(CryptoService);
  });

  /** First login of a user: key pair, wrap under passphrase, upload. */
  async function enrol(userId: string, passphrase: string) {
    const pair = await crypto.generateUserKeyPair();
    const kdf = newKdfParams(1024, 2);
    const kek = await deriveKek(passphrase, kdf);
    server.userKeys.set(userId, {
      publicKey: await crypto.exportPublicKey(pair.publicKey),
      wrappedPrivateKey: await crypto.wrapPrivateKey(pair.privateKey, kek, userId),
      kdf,
    });
  }

  /** A later login: passphrase → private key → own grant → session key. */
  async function unlock(userId: string, passphrase: string) {
    const stored = server.userKeys.get(userId)!;
    const kek = await deriveKek(passphrase, stored.kdf);
    const me: CryptoKeyPair = {
      privateKey: await crypto.unwrapPrivateKey(stored.wrappedPrivateKey, kek, userId),
      publicKey: await crypto.importPublicKey(stored.publicKey),
    };
    const ctx = { orgId, keyVersion: server.keyVersion };
    return { me, dataKey: await crypto.openGrant(server.grants.get(userId)!, me, ctx) };
  }

  it('runs setup → enrol → grant → read/write → wrong passphrase → recovery', async () => {
    // 1. The first coordinator sets up the organisation
    await enrol('coordinator', 'Koordination 2026!');
    const dek = await crypto.generateDataKey();
    server.keyVersion = 1;
    const ctx = { orgId, keyVersion: 1 };
    const coordinatorPub = await crypto.importPublicKey(server.userKeys.get('coordinator')!.publicKey);
    server.grants.set('coordinator', await crypto.sealGrant(dek, coordinatorPub, ctx));
    const recoveryCode = crypto.generateRecoveryCode();
    server.recoveryWrappedKey = await crypto.sealRecovery(dek, recoveryCode, ctx);

    // 2. A caseworker enrols; the coordinator checks the fingerprint and grants
    await enrol('caseworker', 'Fallarbeit sicher 9');
    const caseworkerPubB64 = server.userKeys.get('caseworker')!.publicKey;
    const shownToCaseworker = await crypto.publicKeyFingerprint(caseworkerPubB64);
    const seenByCoordinator = await crypto.publicKeyFingerprint(caseworkerPubB64);
    expect(seenByCoordinator).toBe(shownToCaseworker);

    const coordinator = await unlock('coordinator', 'Koordination 2026!');
    server.grants.set(
      'caseworker',
      await crypto.regrant(
        server.grants.get('coordinator')!,
        coordinator.me,
        await crypto.importPublicKey(caseworkerPubB64),
        ctx,
      ),
    );

    // 3. The caseworker writes, the coordinator reads
    const caseworker = await unlock('caseworker', 'Fallarbeit sicher 9');
    const rowCtx = { table: 'ContactDocumentation', rowId: 'doc-1', field: 'dokumentation' };
    server.rows.set('doc-1', await crypto.encryptField('Hausbesuch, alles gut', caseworker.dataKey, rowCtx));
    expect(server.rows.get('doc-1')).toMatch(/^v1\.1\./);
    expect(await crypto.decryptField(server.rows.get('doc-1')!, () => coordinator.dataKey.key, rowCtx)).toBe(
      'Hausbesuch, alles gut',
    );
    expect(caseworker.dataKey.fingerprint).toBe(coordinator.dataKey.fingerprint);

    // 4. A wrong passphrase gets nowhere
    await expectAsync(unlock('caseworker', 'falsch')).toBeRejectedWithError(WrongPassphraseError);

    // 5. Every coordinator forgot their passphrase: a new coordinator recovers with the code
    await enrol('new-coordinator', 'Neuer Anfang 42');
    const newPub = await crypto.importPublicKey(server.userKeys.get('new-coordinator')!.publicKey);
    const recovered = await crypto.openRecovery(server.recoveryWrappedKey, recoveryCode, ctx, newPub);
    server.grants.set('new-coordinator', recovered.grant);
    const newCoordinator = await unlock('new-coordinator', 'Neuer Anfang 42');
    expect(await crypto.decryptField(server.rows.get('doc-1')!, () => newCoordinator.dataKey.key, rowCtx)).toBe(
      'Hausbesuch, alles gut',
    );
  });
});
