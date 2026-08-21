-- AlterTable
ALTER TABLE "public"."CaseFormResponse" ADD COLUMN     "caregiverId" TEXT,
ADD COLUMN     "childId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."CaseFormResponse" ADD CONSTRAINT "CaseFormResponse_childId_fkey" FOREIGN KEY ("childId") REFERENCES "public"."Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CaseFormResponse" ADD CONSTRAINT "CaseFormResponse_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "public"."Caregiver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
