import { TestBed } from '@angular/core/testing';
import { CryptoService } from './crypto.service';
import { DecryptionError } from '../util/crypto/errors';

describe('CryptoService', () => {
  let service: CryptoService;
  let key: CryptoKey;

  const ctx = {
    table: 'TABLE',
    field: 'FIELD',
    rowId: 'ROW_ID',
  };

  const keyResolver = (v: number) => key;

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
    expect(service.encryptField('message', { version: 5, key }, ctx)).toMatch(
      /^v1\.5.{0,}$/,
    );
  });

  it('changing context throws DecryptionError', async () => {
    const msg1 = await service.encryptField(
      'Grüße aus Flensburg',
      { version: 1, key },
      ctx,
    );
    expect(() =>
      service.decryptField(msg1, keyResolver, { ...ctx, table: 'DIFFERENT' }),
    ).toThrow(DecryptionError);
  });

  it('bad envelope causes CiphertextFormatError', async () => {
    expect(() =>
      service.decryptField('NotAnEnvelope', keyResolver, ctx),
    ).toThrow(DecryptionError);
  });
});
