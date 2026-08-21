/*
  Warnings:

  - A unique constraint covering the columns `[familyId]` on the table `Case` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Child" ADD COLUMN     "healthData" JSONB[];

-- CreateIndex
CREATE UNIQUE INDEX "Case_familyId_key" ON "public"."Case"("familyId");
