jest.mock('../../db', () => ({ prisma: require('../../testUtils/prismaMock').createPrismaMock() }));

import { prisma } from '../../db';
import { createPrismaMock } from '../../testUtils/prismaMock';
import {
  buildCase,
  buildContactDocumentation,
  buildSetting,
  buildZielvereinbarung,
} from '../../testUtils/fixtures';
import { WarningsController } from '../WarningsController';
import { WarningLevel, WarningType, FormType } from '../../../shared/consts';

const prismaMock = prisma as unknown as ReturnType<typeof createPrismaMock>;

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  jest.resetAllMocks();
});

// case.findMany is called up to 3 times per run: 1st = the user's assigned cases, 2nd = closed
// cases missing a closing doc (only reached if a `closing_doc` setting is configured), 3rd =
// cases with a pending/overdue personal-data deletion (always reached). Leaving
// setting.findUnique unmocked (resolves undefined) skips the 2nd call, so a single persistent
// case.findMany stub covers every scenario below except the CLOSED_WITHOUT_DOC one.
function stubEmptyBaseline() {
  prismaMock.case.findMany.mockResolvedValue([]);
  prismaMock.zielvereinbarung.findMany.mockResolvedValue([]);
  prismaMock.contactDocumentation.findMany.mockResolvedValue([]);
  prismaMock.caseFormResponse.findMany.mockResolvedValue([]);
}

describe('WarningsController.getWarnings', () => {
  it('warns ZV_EXPIRED for an overdue zielvereinbarung', async () => {
    stubEmptyBaseline();
    const zv = buildZielvereinbarung({ finishBy: new Date(Date.now() - 10 * DAY) });
    prismaMock.zielvereinbarung.findMany.mockResolvedValue([zv]);

    const warnings = await WarningsController.getWarnings('user-1');

    expect(warnings).toEqual([
      {
        level: WarningLevel.WARNING,
        type: WarningType.ZV_EXPIRED,
        data: { zielvereinbarungsId: zv.id, caseId: zv.caseId, finishBy: zv.finishBy },
      },
    ]);
  });

  it('warns ZV_EXPIRING_SOON when the zielvereinbarung deadline is still in the future', async () => {
    stubEmptyBaseline();
    const zv = buildZielvereinbarung({ finishBy: new Date(Date.now() + 3 * DAY) });
    prismaMock.zielvereinbarung.findMany.mockResolvedValue([zv]);

    const warnings = await WarningsController.getWarnings('user-1');

    expect(warnings).toEqual([
      {
        level: WarningLevel.INFO,
        type: WarningType.ZV_EXPIRING_SOON,
        data: { zielvereinbarungsId: zv.id, caseId: zv.caseId, finishBy: zv.finishBy },
      },
    ]);
  });

  it('warns CASE_NO_CONTACT when a case has no contact documentation at all', async () => {
    const userCase = buildCase();
    prismaMock.case.findMany.mockResolvedValueOnce([userCase]).mockResolvedValue([]);
    prismaMock.zielvereinbarung.findMany.mockResolvedValue([]);
    prismaMock.contactDocumentation.findFirst.mockResolvedValue(null);
    prismaMock.contactDocumentation.findMany.mockResolvedValue([]);
    prismaMock.caseFormResponse.findMany.mockResolvedValue([]);

    const warnings = await WarningsController.getWarnings('user-1');

    expect(warnings).toEqual([
      {
        level: WarningLevel.INFO,
        type: WarningType.CASE_NO_CONTACT,
        data: { caseId: userCase.id, lastContact: null },
      },
    ]);
  });

  it('warns CASE_NO_CONTACT when the last contact is older than 2 months', async () => {
    const userCase = buildCase();
    prismaMock.case.findMany.mockResolvedValueOnce([userCase]).mockResolvedValue([]);
    prismaMock.zielvereinbarung.findMany.mockResolvedValue([]);
    const oldContact = buildContactDocumentation({ date: new Date(Date.now() - 90 * DAY) });
    prismaMock.contactDocumentation.findFirst.mockResolvedValue(oldContact);
    prismaMock.contactDocumentation.findMany.mockResolvedValue([]);
    prismaMock.caseFormResponse.findMany.mockResolvedValue([]);

    const warnings = await WarningsController.getWarnings('user-1');

    expect(warnings).toEqual([
      {
        level: WarningLevel.INFO,
        type: WarningType.CASE_NO_CONTACT,
        data: { caseId: userCase.id, lastContact: oldContact.date },
      },
    ]);
  });

  it('does not warn when the last contact is recent', async () => {
    const userCase = buildCase();
    prismaMock.case.findMany.mockResolvedValueOnce([userCase]).mockResolvedValue([]);
    prismaMock.zielvereinbarung.findMany.mockResolvedValue([]);
    const recentContact = buildContactDocumentation({ date: new Date(Date.now() - 7 * DAY) });
    prismaMock.contactDocumentation.findFirst.mockResolvedValue(recentContact);
    prismaMock.contactDocumentation.findMany.mockResolvedValue([]);
    prismaMock.caseFormResponse.findMany.mockResolvedValue([]);

    const warnings = await WarningsController.getWarnings('user-1');

    expect(warnings).toEqual([]);
  });

  it('warns UNFINISHED_FORM for an incomplete contact documentation', async () => {
    stubEmptyBaseline();
    const incompleteDoc = buildContactDocumentation({ duration: undefined as any });
    prismaMock.contactDocumentation.findMany.mockResolvedValue([incompleteDoc]);

    const warnings = await WarningsController.getWarnings('user-1');

    expect(warnings).toEqual([
      {
        level: WarningLevel.WARNING,
        type: WarningType.UNFINISHED_FORM,
        data: {
          formType: FormType.CONTACT_DOC,
          responseId: incompleteDoc.id,
          caseId: incompleteDoc.caseId,
        },
      },
    ]);
  });

  it('does not warn about a complete contact documentation', async () => {
    stubEmptyBaseline();
    const completeDoc = buildContactDocumentation({
      zusammenfassung: 'done',
      dokumentation: 'done',
    });
    prismaMock.contactDocumentation.findMany.mockResolvedValue([completeDoc]);

    const warnings = await WarningsController.getWarnings('user-1');

    expect(warnings).toEqual([]);
  });

  it('warns CLOSED_WITHOUT_DOC for a closed case missing a closing document', async () => {
    const closedAt = new Date('2026-01-15');
    const closedCase = buildCase({ closedAt, closingDocId: null });
    prismaMock.case.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([closedCase])
      .mockResolvedValue([]);
    prismaMock.zielvereinbarung.findMany.mockResolvedValue([]);
    prismaMock.contactDocumentation.findMany.mockResolvedValue([]);
    prismaMock.caseFormResponse.findMany.mockResolvedValue([]);
    prismaMock.setting.findUnique.mockResolvedValue(
      buildSetting({ name: 'closing_doc', value: 'closing-form-id' })
    );

    const warnings = await WarningsController.getWarnings('user-1');

    expect(warnings).toEqual([
      {
        level: WarningLevel.WARNING,
        type: WarningType.CLOSED_WITHOUT_DOC,
        data: { caseId: closedCase.id, closedAt },
      },
    ]);
  });

  it('warns PENDING_PERSONAL_DATA_DELETION for a case with an overdue personalDataDueAt', async () => {
    const personalDataDueAt = new Date(Date.now() - 5 * DAY);
    const dueCase = buildCase({ personalDataDueAt });
    stubEmptyBaseline();
    prismaMock.case.findMany.mockResolvedValueOnce([]).mockResolvedValue([dueCase]);

    const warnings = await WarningsController.getWarnings('user-1');

    expect(warnings).toEqual([
      {
        level: WarningLevel.WARNING,
        type: WarningType.PENDING_PERSONAL_DATA_DELETION,
        data: { caseId: dueCase.id, personalDataDueAt },
      },
    ]);
  });

  it('returns no warnings when everything is in order', async () => {
    stubEmptyBaseline();

    const warnings = await WarningsController.getWarnings('user-1');

    expect(warnings).toEqual([]);
  });
});
