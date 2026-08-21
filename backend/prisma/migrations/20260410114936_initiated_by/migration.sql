/*
  Warnings:

  - Added the required column `createdById` to the `Handover` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Handover" ADD COLUMN     "createdById" TEXT NOT NULL;
