import { prisma } from '../db';
import { purgeFamilyPersonalData } from './personalDataPurge';

const POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly

/**
 * Purges every case whose personalDataDueAt has passed. personalDataDueAt is already fully
 * computed and stored at close/reopen time (see CaseController.closeCase), so this never needs
 * to read the retention setting or derive anything from closedAt itself.
 */
export async function runPersonalDataRetentionSweep(): Promise<number> {
  const due = await prisma.case.findMany({
    where: {
      personalDataDueAt: { not: null, lte: new Date() },
      familyId: { not: null },
    },
    select: { id: true },
  });

  for (const c of due) {
    await purgeFamilyPersonalData(c.id);
  }

  return due.length;
}

export function startPersonalDataRetentionJob(): void {
  runPersonalDataRetentionSweep().catch((e) =>
    console.error('Personal data retention sweep failed', e)
  );
  setInterval(() => {
    runPersonalDataRetentionSweep().catch((e) =>
      console.error('Personal data retention sweep failed', e)
    );
  }, POLL_INTERVAL_MS);
}
