/*
  Warnings:

  - Added the required column `organisationId` to the `Case` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Case" ADD COLUMN     "organisationId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Case" ADD CONSTRAINT "Case_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "public"."Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
