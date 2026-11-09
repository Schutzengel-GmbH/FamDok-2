import { TestBed } from '@angular/core/testing';
import { CryptoService, UnlockedDataKey } from './crypto.service';
import {
  DecryptionError,
  InvalidGrantError,
  UnknownKeyVersionError,
  WrongRecoveryCodeError,
} from '../util/crypto/errors';
import {
  CiphertextFormatError,
  isGrant,
  isRecoveryWrappedKey,
} from '../../../../shared/utils/ciphertext';
import { deriveKek, newKdfParams } from '../util/crypto/kdf';

const userId = '11111111-1111-4111-8111-111111111111';
const fieldCtx = { table: 'ContactDocumentation', rowId: 'row-1', field: 'dokumentation' };
const orgCtx = { orgId: 'org-1', keyVersion: 1 };

/** Flips the first character of the part at `index` of a dot-separated string. */
function flip(s: string, index: number) {
  const parts = s.split('.');
  parts[index] = (parts[index][0] === 'A' ? 'B' : 'A') + parts[index].slice(1);
  return parts.join('.');
}

describe('CryptoService keys', () => {
  let service: CryptoService;

  beforeEach(() => {
    service = TestBed.inject(CryptoService);
  });

  /** A user as the app holds them: private key unwrapped (non-extractable) plus public key. */
  async function makeUser(): Promise<{ pair: CryptoKeyPair; publicKey: string }> {
    const gen = await service.generateUserKeyPair();
    const kek = await deriveKek('passphrase', newKdfParams(1024, 2));
    const wrapped = await service.wrapPrivateKey(gen.privateKey, kek, userId);
    const privateKey = await service.unwrapPrivateKey(wrapped, kek, userId);
    const publicKey = await service.exportPublicKey(gen.publicKey);
    return {
      pair: { privateKey, publicKey: await service.importPublicKey(publicKey) },
      publicKey,
    };
  }

  describe('grants', () => {
    let dek: CryptoKey;
    let alice: Awaited<ReturnType<typeof makeUser>>;

    beforeEach(async () => {
      dek = await service.generateDataKey();
      alice = await makeUser();
    });

    it('opens a sealed grant into a key that decrypts what the original key encrypted', async () => {
      const envelope = await service.encryptField('geheim', { version: 1, key: dek }, fieldCtx);
      const grant = await service.sealGrant(dek, alice.pair.publicKey, orgCtx);
      const opened = await service.openGrant(grant, alice.pair, orgCtx);

      expect(opened.key.extractable).toBeFalse();
      expect([...opened.key.usages].sort()).toEqual(['decrypt', 'encrypt']);
      expect(opened.version).toBe(1);
      expect(await service.decryptField(envelope, () => opened.key, fieldCtx)).toBe('geheim');
    });

    it('works with a private key that went through the passphrase wrap', async () => {
      // makeUser already returns an unwrapped, non-extractable private key
      expect(alice.pair.privateKey.extractable).toBeFalse();
      const grant = await service.sealGrant(dek, alice.pair.publicKey, orgCtx);
      await expectAsync(service.openGrant(grant, alice.pair, orgCtx)).toBeResolved();
    });

    it('produces a 155 character g1 grant, different every time', async () => {
      const g1 = await service.sealGrant(dek, alice.pair.publicKey, orgCtx);
      const g2 = await service.sealGrant(dek, alice.pair.publicKey, orgCtx);
      expect(g1.length).toBe(155);
      expect(isGrant(g1)).toBeTrue();
      expect(g1).not.toBe(g2);
    });

    it('rejects a grant opened by another key pair', async () => {
      const bob = await makeUser();
      const grant = await service.sealGrant(dek, alice.pair.publicKey, orgCtx);
      await expectAsync(service.openGrant(grant, bob.pair, orgCtx)).toBeRejectedWithError(
        InvalidGrantError,
      );
    });

    it('rejects a grant presented under another key version or org', async () => {
      const grant = await service.sealGrant(dek, alice.pair.publicKey, orgCtx);
      await expectAsync(
        service.openGrant(grant, alice.pair, { ...orgCtx, keyVersion: 2 }),
      ).toBeRejectedWithError(InvalidGrantError);
      await expectAsync(
        service.openGrant(grant, alice.pair, { ...orgCtx, orgId: 'org-2' }),
      ).toBeRejectedWithError(InvalidGrantError);
    });

    it('rejects tampered grants', async () => {
      const grant = await service.sealGrant(dek, alice.pair.publicKey, orgCtx);
      await expectAsync(service.openGrant(flip(grant, 2), alice.pair, orgCtx)).toBeRejectedWithError(
        InvalidGrantError,
      );
      await expectAsync(service.openGrant(flip(grant, 1), alice.pair, orgCtx)).toBeRejectedWithError(
        InvalidGrantError,
      );
    });

    it('rejects a malformed grant string', async () => {
      await expectAsync(service.openGrant('g1.nope', alice.pair, orgCtx)).toBeRejectedWithError(
        CiphertextFormatError,
      );
    });

    it('refuses to seal a non-extractable key', async () => {
      const grant = await service.sealGrant(dek, alice.pair.publicKey, orgCtx);
      const opened = await service.openGrant(grant, alice.pair, orgCtx);
      await expectAsync(service.sealGrant(opened.key, alice.pair.publicKey, orgCtx)).toBeRejected();
    });

    it('regrants the key to another user without an extractable session key', async () => {
      const bob = await makeUser();
      const coordinatorGrant = await service.sealGrant(dek, alice.pair.publicKey, orgCtx);
      const coordinatorKey = await service.openGrant(coordinatorGrant, alice.pair, orgCtx);
      const envelope = await service.encryptField('für Bob', coordinatorKey, fieldCtx);

      const bobGrant = await service.regrant(coordinatorGrant, alice.pair, bob.pair.publicKey, orgCtx);
      const bobKey = await service.openGrant(bobGrant, bob.pair, orgCtx);

      expect(await service.decryptField(envelope, () => bobKey.key, fieldCtx)).toBe('für Bob');
      expect(bobKey.fingerprint).toBe(coordinatorKey.fingerprint);
    });

    it('gives the same key the same fingerprint and different keys different ones', async () => {
      const other = await service.generateDataKey();
      const a = await service.openGrant(await service.sealGrant(dek, alice.pair.publicKey, orgCtx), alice.pair, orgCtx);
      const b = await service.openGrant(await service.sealGrant(dek, alice.pair.publicKey, orgCtx), alice.pair, orgCtx);
      const c = await service.openGrant(await service.sealGrant(other, alice.pair.publicKey, orgCtx), alice.pair, orgCtx);
      expect(a.fingerprint).toBe(b.fingerprint);
      expect(a.fingerprint).not.toBe(c.fingerprint);
      expect(a.fingerprint).toMatch(/^(\d{5} ){5}\d{5}$/);
    });

    it('imports public keys as extractable, which HPKE needs to seal', async () => {
      expect(alice.pair.publicKey.extractable).toBeTrue();
    });
  });

  describe('recovery', () => {
    let dek: CryptoKey;
    let code: string;
    let wrapped: string;

    beforeEach(async () => {
      dek = await service.generateDataKey();
      code = service.generateRecoveryCode();
      wrapped = await service.sealRecovery(dek, code, orgCtx);
    });

    it('opens with the code and grants the key to a new key pair', async () => {
      const envelope = await service.encryptField('alt', { version: 1, key: dek }, fieldCtx);
      const coordinator = await makeUser();
      const { grant, dataKey } = await service.openRecovery(wrapped, code, orgCtx, coordinator.pair.publicKey);

      expect(isRecoveryWrappedKey(wrapped)).toBeTrue();
      expect(dataKey.key.extractable).toBeFalse();
      expect(await service.decryptField(envelope, () => dataKey.key, fieldCtx)).toBe('alt');
      const fromGrant = await service.openGrant(grant, coordinator.pair, orgCtx);
      expect(fromGrant.fingerprint).toBe(dataKey.fingerprint);
    });

    it('accepts the code typed sloppily', async () => {
      const coordinator = await makeUser();
      const sloppy = code.toLowerCase().replace(/-/g, ' ');
      await expectAsync(service.openRecovery(wrapped, sloppy, orgCtx, coordinator.pair.publicKey)).toBeResolved();
    });

    it('rejects a wrong code, version or org', async () => {
      const coordinator = await makeUser();
      const pub = coordinator.pair.publicKey;
      await expectAsync(
        service.openRecovery(wrapped, service.generateRecoveryCode(), orgCtx, pub),
      ).toBeRejectedWithError(WrongRecoveryCodeError);
      await expectAsync(
        service.openRecovery(wrapped, code, { ...orgCtx, keyVersion: 2 }, pub),
      ).toBeRejectedWithError(WrongRecoveryCodeError);
      await expectAsync(
        service.openRecovery(wrapped, code, { ...orgCtx, orgId: 'org-2' }, pub),
      ).toBeRejectedWithError(WrongRecoveryCodeError);
    });
  });

  describe('bytes', () => {
    let key: UnlockedDataKey;

    beforeEach(async () => {
      const dek = await service.generateDataKey();
      key = { version: 3, key: dek, fingerprint: '' };
    });

    it('round-trips binary content in the FDK1 format', async () => {
      const content = Uint8Array.from({ length: 5000 }, (_, i) => i % 251);
      const encrypted = await service.encryptBytes(content, key, fieldCtx);
      expect(Array.from(encrypted.slice(0, 4))).toEqual([0x46, 0x44, 0x4b, 0x31]);
      expect(encrypted.length).toBe(content.length + 20 + 16);
      expect(await service.decryptBytes(encrypted, () => key.key, fieldCtx)).toEqual(content);
    });

    it('rejects the wrong context, a tampered byte or an unknown version', async () => {
      const encrypted = await service.encryptBytes(new Uint8Array([1, 2, 3]), key, fieldCtx);
      await expectAsync(
        service.decryptBytes(encrypted, () => key.key, { ...fieldCtx, rowId: 'row-2' }),
      ).toBeRejectedWithError(DecryptionError);
      const tampered = encrypted.slice();
      tampered[tampered.length - 1] ^= 1;
      await expectAsync(service.decryptBytes(tampered, () => key.key, fieldCtx)).toBeRejectedWithError(
        DecryptionError,
      );
      await expectAsync(service.decryptBytes(encrypted, () => undefined, fieldCtx)).toBeRejectedWithError(
        UnknownKeyVersionError,
      );
    });
  });

  describe('public key fingerprint', () => {
    it('is stable for a key and differs between keys', async () => {
      const a = await makeUser();
      const b = await makeUser();
      expect(await service.publicKeyFingerprint(a.publicKey)).toBe(
        await service.publicKeyFingerprint(a.publicKey),
      );
      expect(await service.publicKeyFingerprint(a.publicKey)).not.toBe(
        await service.publicKeyFingerprint(b.publicKey),
      );
    });
  });

  describe('key continuity proofs', () => {
    const orgId = 'org-1';
    let alice: Awaited<ReturnType<typeof makeUser>>;

    /** Generates a key version and opens it the way a session would. */
    async function version(keyVersion: number) {
      const dek = await service.generateDataKey();
      const ctx = { orgId, keyVersion };
      const opened = await service.openGrant(
        await service.sealGrant(dek, alice.pair.publicKey, ctx),
        alice.pair,
        ctx,
      );
      return { dek, opened };
    }

    beforeEach(async () => {
      alice = await makeUser();
    });

    it('fingerprints a generated key like the opened grant does', async () => {
      const v1 = await version(1);
      expect(await service.fingerprintDataKey(v1.dek)).toBe(v1.opened.fingerprint);
    });

    it('verifies a proof made with the previous key', async () => {
      const v1 = await version(1);
      const v2 = await version(2);
      const proof = await service.sealKeyProof(
        await service.fingerprintDataKey(v2.dek),
        v1.opened,
        { orgId, keyVersion: 2 },
      );
      expect(await service.verifyKeyProof(proof, v1.opened, v2.opened, orgId)).toBeTrue();
    });

    it('rejects proofs for another key, org or version, and proofs made without the old key', async () => {
      const v1 = await version(1);
      const v2 = await version(2);
      const forged = await version(2);
      const fp2 = await service.fingerprintDataKey(v2.dek);
      const proof = await service.sealKeyProof(fp2, v1.opened, { orgId, keyVersion: 2 });

      expect(await service.verifyKeyProof(proof, v1.opened, forged.opened, orgId)).toBeFalse();
      expect(await service.verifyKeyProof(proof, v1.opened, v2.opened, 'org-2')).toBeFalse();

      // the operator can make a v1 envelope only with a key of its own
      const operatorKey = await version(1);
      const fake = await service.sealKeyProof(
        forged.opened.fingerprint,
        operatorKey.opened,
        { orgId, keyVersion: 2 },
      );
      expect(await service.verifyKeyProof(fake, v1.opened, forged.opened, orgId)).toBeFalse();
      expect(await service.verifyKeyProof('garbage', v1.opened, v2.opened, orgId)).toBeFalse();

      const v3 = await version(3);
      expect(await service.verifyKeyProof(proof, v1.opened, v3.opened, orgId)).toBeFalse();
      expect(() => service.sealKeyProof(fp2, v1.opened, { orgId, keyVersion: 3 })).toThrow();
    });
  });
});
