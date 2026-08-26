import { prisma } from '../db';

/**
 * Purges the personal data belonging to a Case's Family: hard-deletes the Family (cascading its
 * Child/Caregiver rows), deletes every CaseFormResponse (and their Answers) whose CaseForm is
 * flagged containsPersonalData, and nulls the free-text zusammenfassung/dokumentation fields on
 * every ContactDocumentation for the case. The Case row itself, and any non-personal-data
 * CaseFormResponse, survive untouched. Idempotent - a no-op if the case has no family already
 * (i.e. already purged).
 */
export async function purgeFamilyPersonalData(caseId: string): Promise<void> {
  const c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
  if (!c.familyId) return;

  const personalResponseIds = (
    await prisma.caseFormResponse.findMany({
      where: { caseId, caseForm: { containsPersonalData: true } },
      select: { id: true },
    })
  ).map((r) => r.id);

  await prisma.$transaction([
    prisma.answer.deleteMany({
      where: { caseFormResponseId: { in: personalResponseIds } },
    }),
    prisma.caseFormResponse.deleteMany({
      where: { id: { in: personalResponseIds } },
    }),
    prisma.contactDocumentation.updateMany({
      where: { caseId },
      data: { zusammenfassung: null, dokumentation: null },
    }),
    prisma.case.update({
      where: { id: caseId },
      data: { personalDataDeletedAt: new Date() },
    }),
    prisma.family.delete({ where: { id: c.familyId } }),
  ]);
}
