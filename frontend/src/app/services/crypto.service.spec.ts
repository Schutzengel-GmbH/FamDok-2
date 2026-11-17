import { TestBed } from '@angular/core/testing';
import { CryptoService } from './crypto.service';
import {
  DecryptionError,
  UnknownKeyVersionError,
  WrongPassphraseError,
} from '../util/crypto/errors';
import {
  CiphertextFormatError,
  formatEnvelope,
  parseEnvelope,
} from '../../../../shared/utils/ciphertext';
import { deriveKek, newKdfParams } from '../util/crypto/kdf';

const userId = 'abcd-1234-efgh-5678';

describe('CryptoService', () => {
  let service: CryptoService;
  let key: CryptoKey;

  const ctx = {
    table: 'TABLE',
    field: 'FIELD',
    rowId: 'ROW_ID',
  };

  const keyResolver = (v: number) => {
    if (v === 666) return undefined;
    return key;
  };

  beforeEach(async () => {
    service = TestBed.inject(CryptoService);
    key = await service.generateDataKey();
  });

  it('encrypts and decrypts', async () => {
    const msg1 = await service.encryptField('', { version: 1, key }, ctx);
    const msg2 = await service.encryptField(
      'Grüße aus Flensburg',
      { version: 1, key },
      ctx,
    );
    const msg3 = await service.encryptField('🤷‍♂️', { version: 1, key }, ctx);

    const res1 = await service.decryptField(msg1, keyResolver, ctx);
    expect(res1).toBe('');
    const res2 = await service.decryptField(msg2, keyResolver, ctx);
    expect(res2).toBe('Grüße aus Flensburg');
    const res3 = await service.decryptField(msg3, keyResolver, ctx);
    expect(res3).toBe('🤷‍♂️');
  });

  it('encrypts and decrypts (super)json serialisable objects', async () => {
    const object = { date: new Date('1970-01-01'), text: 'some string' };
    const msg = await service.encryptJson<typeof object>(
      object,
      { version: 1, key },
      ctx,
    );
    const res = await service.decryptJson<typeof object>(msg, keyResolver, ctx);
    expect(res).toEqual(object);
  });

  it('gives different encryptions for the same input', async () => {
    const msg1 = await service.encryptField(
      'Grüße aus Flensburg',
      { version: 1, key },
      ctx,
    );
    const msg2 = await service.encryptField(
      'Grüße aus Flensburg',
      { version: 1, key },
      ctx,
    );
    expect(msg1).not.toEqual(msg2);
  });

  it('includes the key version', async () => {
    expect(
      await service.encryptField('message', { version: 5, key }, ctx),
    ).toMatch(/^v1\.5\./);
  });

  it('changing context throws DecryptionError', async () => {
    const msg1 = await service.encryptField(
      'Grüße aus Flensburg',
      { version: 1, key },
      ctx,
    );
    await expectAsync(
      service.decryptField(msg1, keyResolver, {
        ...ctx,
        table: 'DIFFERENT',
      }),
    ).toBeRejectedWithError(DecryptionError);
    await expectAsync(
      service.decryptField(msg1, keyResolver, {
        ...ctx,
        field: 'DIFFERENT',
      }),
    ).toBeRejectedWithError(DecryptionError);
    await expectAsync(
      service.decryptField(msg1, keyResolver, {
        ...ctx,
        rowId: 'DIFFERENT',
      }),
    ).toBeRejectedWithError(DecryptionError);
  });

  it('bad envelope causes CiphertextFormatError', async () => {
    await expectAsync(
      service.decryptField('NotAnEnvelope', keyResolver, ctx),
    ).toBeRejectedWithError(CiphertextFormatError);
  });

  it('undefined key throws UnknownKeyVersionError', async () => {
    const validEnvelope = await service.encryptField(
      'Grüße aus Flensburg',
      { version: 666, key },
      ctx,
    );
    await expectAsync(
      service.decryptField(validEnvelope, keyResolver, ctx),
    ).toBeRejectedWithError(UnknownKeyVersionError);
  });

  it('throws DecryptionError on different key', async () => {
    const msg = await service.encryptField(
      'Grüße aus Flensburg',
      { version: 1, key },
      ctx,
    );
    const key2 = await service.generateDataKey();
    const keyResolver2 = (v: number) => key2;
    await expectAsync(
      service.decryptField(msg, keyResolver2, ctx),
    ).toBeRejectedWithError(DecryptionError);
  });

  it('throws DecryptionError on a flipped input character', async () => {
    const msg = await service.encryptField(
      'Grüße aus Flensburg',
      { version: 1, key },
      ctx,
    );
    const envelope = parseEnvelope(msg);
    const tamperedCt =
      (envelope.ct[0] === 'A' ? 'B' : 'A') + envelope.ct.slice(1);
    const tampered = formatEnvelope(
      envelope.keyVersion,
      envelope.iv,
      tamperedCt,
    );
    await expectAsync(
      service.decryptField(tampered, keyResolver, ctx),
    ).toBeRejectedWithError(DecryptionError);
  });

  it('passes known answer test', async () => {
    const knownMsg = 'Grüße aus Flensburg';
    const knownKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(32).map((_, i) => i),
      'AES-GCM',
      false,
      ['decrypt', 'encrypt'],
    );
    const knownEnvelope =
      'v1.3.AAECAwQFBgcICQoL.AHAVpwZ6pzvsNOSr94UdA_C08kaXvZzEWyGHGYec7Xl1NwGhuw';
    const knownKeys = (n: number) => knownKey;
    const knownCtx = {
      table: 'ContactDocumentation',
      rowId: '11111111-1111-4111-8111-111111111111',
      field: 'dokumentation',
    };
    const fixedIV = new Uint8Array(12).map((_, i) => i);
    const msg = await service.decryptField(knownEnvelope, knownKeys, knownCtx);
    expect(msg).toEqual(knownMsg);

    spyOn(service as any, 'randomBytes').and.returnValue(fixedIV);
    const envelope = await service.encryptField(
      knownMsg,
      { version: 3, key: knownKey },
      knownCtx,
    );
    expect(envelope).toEqual(knownEnvelope);
  });

  describe('user key wrapping', () => {
    const passphrase = 'Grüße aus Flensburg';
    const params = newKdfParams(1024, 2); // cheap: we test wiring, not Argon2 cost
    let kek: CryptoKey;
    let pair: CryptoKeyPair;
    let wrapped: string;

    beforeAll(async () => {
      kek = await deriveKek(passphrase, params);
    });

    beforeEach(async () => {
      pair = await service.generateUserKeyPair();
      wrapped = await service.wrapPrivateKey(pair.privateKey, kek, userId);
    });

    it('exports a public key as 122 b64url chars and imports it back', async () => {
      const exported = await service.exportPublicKey(pair.publicKey);
      expect(exported.length).toBe(122);
      const imported = await service.importPublicKey(exported);
      expect(imported.usages).toEqual([]);
      expect(await service.exportPublicKey(imported)).toBe(exported);
    });

    it('unwraps with a KEK re-derived from the same passphrase', async () => {
      const kek2 = await deriveKek(passphrase, params); // the real login flow
      const priv = await service.unwrapPrivateKey(wrapped, kek2, userId);
      expect(priv.extractable).toBeFalse();
      expect(priv.usages).toEqual(['deriveBits']);
      await expectAsync(crypto.subtle.exportKey('pkcs8', priv)).toBeRejected();
    });

    it('unwrapped key computes the same ECDH secret', async () => {
      const other = await service.generateUserKeyPair();
      const priv = await service.unwrapPrivateKey(wrapped, kek, userId);
      const ab = new Uint8Array(
        await crypto.subtle.deriveBits(
          { name: 'ECDH', public: other.publicKey },
          priv,
          256,
        ),
      );
      const ba = new Uint8Array(
        await crypto.subtle.deriveBits(
          { name: 'ECDH', public: pair.publicKey },
          other.privateKey,
          256,
        ),
      );
      expect(ab).toEqual(ba);
    });

    it('wrong passphrase → WrongPassphraseError', async () => {
      const wrongKek = await deriveKek('Grüße aus Kiel', params);
      await expectAsync(
        service.unwrapPrivateKey(wrapped, wrongKek, userId),
      ).toBeRejectedWithError(WrongPassphraseError);
    });

    it('wrong userId → WrongPassphraseError', async () => {
      await expectAsync(
        service.unwrapPrivateKey(wrapped, kek, 'someone-else'),
      ).toBeRejectedWithError(WrongPassphraseError);
    });

    it('flipped first ciphertext char → WrongPassphraseError', async () => {
      const [k, iv, ct] = wrapped.split('.');
      const tampered = `${k}.${iv}.${(ct[0] === 'A' ? 'B' : 'A') + ct.slice(1)}`;
      await expectAsync(
        service.unwrapPrivateKey(tampered, kek, userId),
      ).toBeRejectedWithError(WrongPassphraseError);
    });

    it('malformed k1 string → CiphertextFormatError', async () => {
      await expectAsync(
        service.unwrapPrivateKey('k1.nope', kek, userId),
      ).toBeRejectedWithError(CiphertextFormatError);
    });
  });
});
