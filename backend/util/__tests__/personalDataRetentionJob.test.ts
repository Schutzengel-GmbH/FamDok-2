jest.mock('../../db', () => ({ prisma: require('../../testUtils/prismaMock').createPrismaMock() }));
jest.mock('../personalDataPurge', () => ({ purgeFamilyPersonalData: jest.fn() }));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import { buildCase } from '../../testUtils/fixtures';
import { runPersonalDataRetentionSweep } from '../personalDataRetentionJob';
import { purgeFamilyPersonalData } from '../personalDataPurge';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;
const purgeMock = purgeFamilyPersonalData as jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
});

describe('runPersonalDataRetentionSweep', () => {
  it('purges every case whose personalDataDueAt has passed', async () => {
    const overdue = buildCase({ personalDataDueAt: new Date('2020-01-01') });
    prismaMock.case.findMany.mockResolvedValue([{ id: overdue.id }]);

    const count = await runPersonalDataRetentionSweep();

    expect(prismaMock.case.findMany).toHaveBeenCalledWith({
      where: {
        personalDataDueAt: { not: null, lte: expect.any(Date) },
        familyId: { not: null },
      },
      select: { id: true },
    });
    expect(purgeMock).toHaveBeenCalledWith(overdue.id);
    expect(count).toBe(1);
  });

  it('does nothing when no case is due', async () => {
    prismaMock.case.findMany.mockResolvedValue([]);

    const count = await runPersonalDataRetentionSweep();

    expect(purgeMock).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });
});
