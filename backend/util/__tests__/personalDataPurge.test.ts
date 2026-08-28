jest.mock('../../db', () => ({ prisma: require('../../testUtils/prismaMock').createPrismaMock() }));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import { buildCase, buildCaseFormResponse } from '../../testUtils/fixtures';
import { purgeFamilyPersonalData } from '../personalDataPurge';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

beforeEach(() => {
  jest.resetAllMocks();
  prismaMock.$transaction.mockImplementation((operations: unknown[]) =>
    Promise.all(operations)
  );
});

describe('purgeFamilyPersonalData', () => {
  it('is a no-op when the case has no family (already purged)', async () => {
    prismaMock.case.findUniqueOrThrow.mockResolvedValue(buildCase({ familyId: null }));

    await purgeFamilyPersonalData('case-1');

    expect(prismaMock.caseFormResponse.findMany).not.toHaveBeenCalled();
    expect(prismaMock.family.delete).not.toHaveBeenCalled();
  });

  it('deletes only containsPersonalData responses (and their answers), nulls contact doc fields, deletes the family', async () => {
    const c = buildCase({ familyId: 'family-1' });
    prismaMock.case.findUniqueOrThrow.mockResolvedValue(c);
    const personalResponse = buildCaseFormResponse({ id: 'response-personal' });
    prismaMock.caseFormResponse.findMany.mockResolvedValue([{ id: personalResponse.id }]);

    await purgeFamilyPersonalData(c.id);

    expect(prismaMock.caseFormResponse.findMany).toHaveBeenCalledWith({
      where: { caseId: c.id, caseForm: { containsPersonalData: true } },
      select: { id: true },
    });
    expect(prismaMock.answer.deleteMany).toHaveBeenCalledWith({
      where: { caseFormResponseId: { in: [personalResponse.id] } },
    });
    expect(prismaMock.caseFormResponse.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [personalResponse.id] } },
    });
    expect(prismaMock.contactDocumentation.updateMany).toHaveBeenCalledWith({
      where: { caseId: c.id },
      data: { zusammenfassung: null, dokumentation: null },
    });
    expect(prismaMock.case.update).toHaveBeenCalledWith({
      where: { id: c.id },
      data: { personalDataDeletedAt: expect.any(Date) },
    });
    expect(prismaMock.family.delete).toHaveBeenCalledWith({ where: { id: 'family-1' } });
  });

  it('leaves non-personal-data responses untouched', async () => {
    const c = buildCase({ familyId: 'family-1' });
    prismaMock.case.findUniqueOrThrow.mockResolvedValue(c);
    // no responses match containsPersonalData: true
    prismaMock.caseFormResponse.findMany.mockResolvedValue([]);

    await purgeFamilyPersonalData(c.id);

    expect(prismaMock.answer.deleteMany).toHaveBeenCalledWith({
      where: { caseFormResponseId: { in: [] } },
    });
    expect(prismaMock.caseFormResponse.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [] } },
    });
  });
});
