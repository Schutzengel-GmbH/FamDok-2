import { fromB64Url, toB64Url } from '../../../../../shared/utils/ciphertext';
import { InvalidKdfParamsError } from './errors';
import {
  deriveKek,
  deriveKeyBytes,
  KdfParams,
  newKdfParams,
  validateKdfParams,
} from './kdf';

const knownPassphrase: string = 'Grüße aus Flensburg';
const knownSaltStr: string = 'AAECAwQFBgcICQoLDA0ODw';
const knownParams: KdfParams = {
  alg: 'argon2id',
  salt: knownSaltStr,
  memoryKiB: 1024,
  iterations: 2,
  parallelism: 1,
};
const expectedKeyB64Url = 'XIhqbV5C9tXaVKVcz2lXSXKN1ecvoyukx3uQAYsX8Mw';

describe('kdf', () => {
  describe('newKdfParams', () => {
    it('gives a different salt each time', () => {
      const p1 = newKdfParams();
      const p2 = newKdfParams();
      const p3 = newKdfParams(1022, 5);

      expect(p1.salt).not.toEqual(p2.salt);
      expect(p2.salt).not.toEqual(p3.salt);
      expect(p1.salt).not.toEqual(p3.salt);
    });

    it('gives a salt that decodes to 16 bytes', () => {
      const p1 = newKdfParams();
      const p2 = newKdfParams(1024, 5);

      expect(fromB64Url(p1.salt).length).toBe(16);
      expect(fromB64Url(p2.salt).length).toBe(16);
    });
  });

  describe('validateKdfParams', () => {
    const validSalt = crypto.getRandomValues(new Uint8Array(16));
    const validSaltStr = toB64Url(validSalt);
    const validParams: KdfParams = {
      alg: 'argon2id',
      salt: validSaltStr,
      memoryKiB: 1024,
      iterations: 2,
      parallelism: 1,
    };

    it('rejects NaN / fractional memory', () => {
      expect(() =>
        validateKdfParams({
          ...knownParams,
          memoryKiB: NaN,
        }),
      ).toThrowError(InvalidKdfParamsError);
      expect(() =>
        validateKdfParams({
          ...knownParams,
          memoryKiB: 1023.5,
        }),
      ).toThrowError(InvalidKdfParamsError);
    });
    it('rejects 11 iterations', () => {
      /* … */
      expect(() =>
        validateKdfParams({
          ...knownParams,
          iterations: 11,
        }),
      ).toThrowError(InvalidKdfParamsError);
    });
    it('rejects invalid salt characters', () => {
      expect(() =>
        validateKdfParams({
          ...knownParams,
          salt: '!'.repeat(22),
        }),
      ).toThrowError(InvalidKdfParamsError);
    });
    it('rejects a 15-byte salt', () => {
      /* salt: toB64Url(new Uint8Array(15)) */
      expect(() =>
        validateKdfParams({
          ...knownParams,
          salt: toB64Url(new Uint8Array(15)),
        }),
      ).toThrowError(InvalidKdfParamsError);
    });

    for (const field of [
      'alg',
      'salt',
      'memoryKiB',
      'iterations',
      'parallelism',
    ] as const) {
      it(`rejects missing ${field}`, () => {
        const p: Partial<KdfParams> = { ...validParams };
        delete p[field];
        expect(() => validateKdfParams(p as KdfParams)).toThrowError(
          InvalidKdfParamsError,
        );
      });
    }

    // deriveKeyBytes
    it('NFD passphrase yields the KAT value', async () => {
      const bytes = await deriveKeyBytes(
        knownPassphrase.normalize('NFD'),
        knownParams,
      );
      expect(toB64Url(bytes)).toBe(expectedKeyB64Url);
    });

    it('rejects invalid params', async () => {
      await expectAsync(
        deriveKeyBytes('x', { ...knownParams, iterations: 0 }),
      ).toBeRejectedWithError(InvalidKdfParamsError);
    });

    it('throws InvalidKdfParamsError on bad salt', () => {
      const badParams = { ...validParams, salt: validSaltStr + 'A' };
      expect(() => validateKdfParams(badParams)).toThrowError(
        InvalidKdfParamsError,
      );
    });

    it('throws InvalidKdfParamsError on low memory', () => {
      const badParams = { ...validParams, memoryKiB: 4 };
      expect(() => validateKdfParams(badParams)).toThrowError(
        InvalidKdfParamsError,
      );
    });

    it('throws InvalidKdfParamsError on high memory', () => {
      const badParams = { ...validParams, memoryKiB: 4_000_000 };
      expect(() => validateKdfParams(badParams)).toThrowError(
        InvalidKdfParamsError,
      );
    });

    it('throws InvalidKdfParamsError on bad iterations', () => {
      const badParams1 = { ...validParams, iterations: -1 };
      const badParams2 = { ...validParams, iterations: 1.5 };
      const badParams3 = { ...validParams, iterations: 0 };
      expect(() => validateKdfParams(badParams1)).toThrowError(
        InvalidKdfParamsError,
      );
      expect(() => validateKdfParams(badParams2)).toThrowError(
        InvalidKdfParamsError,
      );
      expect(() => validateKdfParams(badParams3)).toThrowError(
        InvalidKdfParamsError,
      );
    });

    it('throws InvalidKdfParamsError on bad parallelism', () => {
      const badParams = { ...validParams, parallelism: 4 };
      expect(() => validateKdfParams(badParams as KdfParams)).toThrowError(
        InvalidKdfParamsError,
      );
    });

    it('throws InvalidKdfParamsError on unknown algorithm', () => {
      const badParams = { ...validParams, alg: 'argonauts' };
      expect(() => validateKdfParams(badParams as KdfParams)).toThrowError(
        InvalidKdfParamsError,
      );
    });
  });

  describe('deriveKeyBytes', () => {
    it('accepts valid params and the defaults', () => {
      expect(() => validateKdfParams(knownParams)).not.toThrow();
      expect(() => validateKdfParams(newKdfParams())).not.toThrow();
    });

    it('derives known key bytes', async () => {
      const bytes = await deriveKeyBytes(knownPassphrase, knownParams);

      expect(toB64Url(bytes)).toEqual(expectedKeyB64Url);
    });

    it('derives the same key bytes for same passphrase, salt and params', async () => {
      const b1 = await deriveKeyBytes(knownPassphrase, knownParams);
      const b2 = await deriveKeyBytes(knownPassphrase, knownParams);

      expect(b1).toEqual(b2);
    });

    it('derives different key bytes for different passphrase', async () => {
      const b1 = await deriveKeyBytes(knownPassphrase, knownParams);
      const b2 = await deriveKeyBytes('differentPassphrase', knownParams);

      expect(b1).not.toEqual(b2);
    });

    it('derives different key bytes for different salt', async () => {
      const b1 = await deriveKeyBytes(knownPassphrase, knownParams);
      const diffSalt = toB64Url(crypto.getRandomValues(new Uint8Array(16)));
      const b2 = await deriveKeyBytes(knownPassphrase, {
        ...knownParams,
        salt: diffSalt,
      });

      expect(b1).not.toEqual(b2);
    });
    it('derives different key bytes for different iterations', async () => {
      const b1 = await deriveKeyBytes(knownPassphrase, knownParams);
      const b2 = await deriveKeyBytes(knownPassphrase, {
        ...knownParams,
        iterations: knownParams.iterations + 1,
      });

      expect(b1).not.toEqual(b2);
    });

    it('normalises passphrases', async () => {
      expect('Grüße'.normalize('NFC')).not.toEqual('Grüße'.normalize('NFD'));

      const b1 = await deriveKeyBytes(
        knownPassphrase.normalize('NFC'),
        knownParams,
      );
      const b2 = await deriveKeyBytes(
        knownPassphrase.normalize('NFD'),
        knownParams,
      );

      expect(b1).toEqual(b2);
    });
  });

  describe('deriveKek', () => {
    let kek: CryptoKey;

    beforeAll(async () => {
      kek = await deriveKek(knownPassphrase, knownParams);
    });

    it('returns extractable === false', () => {
      expect(kek.extractable).toBeFalse();
    });
    it('returns wrapKey and unwrapKey', () => {
      expect(kek.usages).toContain('unwrapKey');
      expect(kek.usages).toContain('wrapKey');
    });
  });
});
