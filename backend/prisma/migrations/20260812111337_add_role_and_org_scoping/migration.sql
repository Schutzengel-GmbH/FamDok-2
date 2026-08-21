-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'OrgCoordinator';
ALTER TYPE "Role" ADD VALUE 'SubOrgCoordinator';

-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "subOrganisationId" TEXT;

-- AlterTable
ALTER TABLE "CaseForm" ADD COLUMN     "organisationId" TEXT;

-- AlterTable
ALTER TABLE "GeneralForm" ADD COLUMN     "organisationId" TEXT;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_subOrganisationId_fkey" FOREIGN KEY ("subOrganisationId") REFERENCES "SubOrganisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseForm" ADD CONSTRAINT "CaseForm_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneralForm" ADD CONSTRAINT "GeneralForm_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
