import { add, isBefore, sub } from 'date-fns';
import { prisma } from '../db';
import { Warning } from '../../shared/types';
import { FormType, WarningLevel, WarningType } from '../../shared/consts';

export class WarningsController {
  static async getWarnings(userId: string): Promise<Warning[]> {
    const warnings: Warning[] = [];

    const now = new Date();
    const userCases = await prisma.case.findMany({
      where: { responsibleUsers: { some: { id: userId } } },
    });

    // check expiring and expired ZV
    const zvs = await prisma.zielvereinbarung.findMany({
      where: {
        case: { responsibleUsers: { some: { id: userId } } },
        finishBy: { lt: add(now, { months: 1 }) },
        status: 'inProgress',
      },
    });
    for (const zv of zvs) {
      if (!zv.caseId) continue;

      if (isBefore(zv.finishBy, now))
        warnings.push({
          level: WarningLevel.WARNING,
          type: WarningType.ZV_EXPIRED,
          data: {
            zielvereinbarungsId: zv.id,
            caseId: zv.caseId,
            finishBy: zv.finishBy,
          },
        });
      else
        warnings.push({
          level: WarningLevel.INFO,
          type: WarningType.ZV_EXPIRING_SOON,
          data: {
            zielvereinbarungsId: zv.id,
            caseId: zv.caseId,
            finishBy: zv.finishBy,
          },
        });
    }
    // check case contacts
    // get latest contact for each
    for (const c of userCases) {
      const contact = await prisma.contactDocumentation.findFirst({
        where: { caseId: c.id },
        orderBy: { date: { sort: 'desc', nulls: 'last' } },
      });
      if (!contact)
        warnings.push({
          level: WarningLevel.INFO,
          type: WarningType.CASE_NO_CONTACT,
          data: {
            caseId: c.id,
            lastContact: null,
          },
        });
      else if (contact.date && isBefore(contact.date, sub(now, { months: 2 })))
        warnings.push({
          level: WarningLevel.INFO,
          type: WarningType.CASE_NO_CONTACT,
          data: {
            caseId: c.id,
            lastContact: contact.date,
          },
        });
    }
    // check forms
    //  - check contactDocs
    const contactDocumentations = await prisma.contactDocumentation.findMany({
      where: {
        caseId: { in: userCases.map((c) => c.id) },
      },
    });
    const unfinishedContactDos = contactDocumentations.filter(
      (doc) =>
        doc.date === null ||
        !doc.dokumentation ||
        !doc.duration ||
        !doc.zusammenfassung ||
        doc.artDerBetreuung === null
    );
    for (const d of unfinishedContactDos) {
      warnings.push({
        level: WarningLevel.WARNING,
        type: WarningType.UNFINISHED_FORM,
        data: {
          formType: FormType.CONTACT_DOC,
          responseId: d.id,
          caseId: d.caseId,
        },
      });
    }
    //  - check caseForms
    const caseFormResponses = await prisma.caseFormResponse.findMany({
      where: { caseId: { in: userCases.map((c) => c.id) } },
      include: { answers: true, caseForm: { include: { questions: true } } },
    });
    const unfinishedCaseFormResponses = caseFormResponses.filter((r) => {
      if (!r.caseForm) return false;

      return r.caseForm.questions.some((q) => {
        if (!q.required) return false;

        const answer = r.answers.find((a) => a.questionId === q.id);
        if (!answer) return true;

        return (
          (!answer.answerSelectId || answer.answerSelectId.length < 1) &&
          answer.answerBool === null &&
          !answer.answerDate &&
          answer.answerInt === null &&
          answer.answerNum === null &&
          answer.answerText === null
        );
      });
    });
    for (const r of unfinishedCaseFormResponses) {
      warnings.push({
        level: WarningLevel.WARNING,
        type: WarningType.UNFINISHED_FORM,
        data: {
          formType: FormType.CASE_FORM,
          responseId: r.id,
          caseId: r.caseId,
          caseFormId: r.caseForm?.id,
        },
      });
    }

    const closingDocSetting = await prisma.setting.findUnique({
      where: { name: 'closing_doc' },
    });
    // if there is no closing doc set, this check makes no sense, so return early
    if (!closingDocSetting) return warnings;

    // check closed cases
    const closedWithNoDoc = await prisma.case.findMany({
      where: {
        responsibleUsers: { some: { id: userId } },
        closedAt: { not: null },
        caseformResponses: { none: { caseFormId: closingDocSetting.value } },
      },
    });
    for (const c of closedWithNoDoc) {
      warnings.push({
        level: WarningLevel.WARNING,
        type: WarningType.CLOSED_WITHOUT_DOC,
        data: {
          caseId: c.id,
          closedAt: c.closedAt!,
        },
      });
    }

    return warnings;
  }
}
