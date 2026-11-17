jest.mock('../../db', () => ({
  prisma: require('../../testUtils/prismaMock').createPrismaMock(),
}));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import { assertEncryptionConfig } from '../encryptionConfig';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

describe('assertEncryptionConfig', () => {
  beforeEach(() => prismaMock.organisation.findMany.mockReset());

  it('passes with the encryption enabled, without looking at the organisations', async () => {
    await expect(assertEncryptionConfig(true)).resolves.toBeUndefined();
    expect(prismaMock.organisation.findMany).not.toHaveBeenCalled();
  });

  it('passes with the encryption off while no organisation has activated it', async () => {
    prismaMock.organisation.findMany.mockResolvedValue([]);
    await expect(assertEncryptionConfig(false)).resolves.toBeUndefined();
    expect(prismaMock.organisation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { keyState: { not: 'uninitialized' } } })
    );
  });

  it('refuses to turn the encryption off once an organisation has activated it', async () => {
    prismaMock.organisation.findMany.mockResolvedValue([{ name: 'Org A' }]);
    await expect(assertEncryptionConfig(false)).rejects.toThrow(/Org A.*cannot be turned off/);
  });
});
