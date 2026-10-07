import { add, isBefore, sub } from 'date-fns';
import { prisma } from '../db';
import { Warning } from '../../shared/types';
import {
  CONTACT_DOCUMENTATION_DEFAULT_INCLUDE,
  FormType,
  QUESTION_DEFAULT_INCLUDE,
  WarningLevel,
  WarningType,
} from '../../shared/consts';
import { Answer } from '../../shared/generated/prisma/client';

export class WarningsController {
  static async getWarnings(userId: string): Promise<Warning[]> {
    const warnings: Warning[] = [];

    const now = new Date();

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
    const userCases = await prisma.case.findMany({
      where: { responsibleUsers: { some: { id: userId } } },
      include: {
        contactDocumentation: {
          take: 1,
          orderBy: { date: { sort: 'desc', nulls: 'last' } },
        },
      },
    });

    for (const c of userCases) {
      const contact = c.contactDocumentation
        ? c.contactDocumentation[0]
        : undefined;

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
          formId: 'CONTACT_DOC',
          caseId: d.caseId,
          unfinishedQuestions: {
            date: d.date,
            dokumentation: d.dokumentation == null,
            duration: d.duration == null,
            zusammenfassung: d.zusammenfassung == null,
            artDerBetreuung: d.artDerBetreuung == null,
          },
        },
      });
    }
    //  - check caseForms
    const caseFormResponses = await prisma.caseFormResponse.findMany({
      where: { caseId: { in: userCases.map((c) => c.id) } },
      include: {
        answers: { include: { question: QUESTION_DEFAULT_INCLUDE } },
      },
    });
    const unfinishedCaseFormResponses = caseFormResponses.filter((r) => {
      if (!r.caseFormId) return false;

      return r.answers.some((a) => {
        if (!a.question.required) return false;

        if (!a) return true;

        return (
          (!a.answerSelectId || a.answerSelectId.length < 1) &&
          a.answerBool === null &&
          !a.answerDate &&
          a.answerInt === null &&
          a.answerNum === null &&
          a.answerText === null
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
          formId: r.caseFormId!,
          unfinishedQuestions: r.answers
            .filter((a) => a.question.required)
            .filter(unansweredFilter)
            .map((a) => a.question),
        },
      });
    }

    const closingDocSetting = await prisma.setting.findUnique({
      where: { name: 'closing_doc' },
    });
    // if there is no closing doc set, this check makes no sense, so skip it - but still fall
    // through to the personal-data-deletion check below, which is unrelated to that setting.
    if (closingDocSetting) {
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
    }

    // check cases with a pending personal-data deletion due date within the next 30 days
    const pendingDeletion = await prisma.case.findMany({
      where: {
        responsibleUsers: { some: { id: userId } },
        personalDataDueAt: { lte: add(now, { days: 30 }) },
        familyId: { not: null },
      },
    });
    for (const c of pendingDeletion) {
      warnings.push({
        level: isBefore(c.personalDataDueAt!, now)
          ? WarningLevel.WARNING
          : WarningLevel.INFO,
        type: WarningType.PENDING_PERSONAL_DATA_DELETION,
        data: {
          caseId: c.id,
          personalDataDueAt: c.personalDataDueAt!,
        },
      });
    }

    return warnings;
  }
}

function unansweredFilter(answer: Answer) {
  return (
    (!answer.answerSelectId || answer.answerSelectId.length < 1) &&
    answer.answerBool === null &&
    !answer.answerDate &&
    answer.answerInt === null &&
    answer.answerNum === null &&
    answer.answerText === null
  );
}
