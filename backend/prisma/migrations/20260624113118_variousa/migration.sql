/*
  Warnings:

  - Made the column `closedAt` on table `Case` required. This step will fail if there are existing NULL values in that column.
  - Made the column `closingDocId` on table `Case` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Caregiver" DROP CONSTRAINT "Caregiver_familyId_fkey";

-- DropForeignKey
ALTER TABLE "Child" DROP CONSTRAINT "Child_familyId_fkey";

-- DropForeignKey
ALTER TABLE "ContactDocumentation" DROP CONSTRAINT "ContactDocumentation_caseId_fkey";

-- DropForeignKey
ALTER TABLE "Handover" DROP CONSTRAINT "Handover_caseId_fkey";

-- AlterTable
ALTER TABLE "Case" ALTER COLUMN "closedAt" SET NOT NULL,
ALTER COLUMN "closingDocId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caregiver" ADD CONSTRAINT "Caregiver_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactDocumentation" ADD CONSTRAINT "ContactDocumentation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
