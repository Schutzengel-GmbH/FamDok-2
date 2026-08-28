-- DropForeignKey
ALTER TABLE "Case" DROP CONSTRAINT "Case_familyId_fkey";

-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "personalDataDeletedAt" TIMESTAMP(3),
ADD COLUMN     "personalDataDueAt" TIMESTAMP(3),
ALTER COLUMN "familyId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;
