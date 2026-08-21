/*
  Warnings:

  - You are about to drop the column `caseformDefinitionId` on the `CaseFormResponse` table. All the data in the column will be lost.
  - You are about to drop the column `response` on the `CaseFormResponse` table. All the data in the column will be lost.
  - You are about to drop the column `response` on the `ClosingDocumentation` table. All the data in the column will be lost.
  - You are about to drop the column `response` on the `ContactDocumentation` table. All the data in the column will be lost.
  - You are about to drop the column `generalFormDefinitionId` on the `GeneralFormResponse` table. All the data in the column will be lost.
  - You are about to drop the column `response` on the `GeneralFormResponse` table. All the data in the column will be lost.
  - You are about to drop the `CaseFormDefinition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GeneralFormDefinition` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `artDerBetreuung` to the `ContactDocumentation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `duration` to the `ContactDocumentation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `generalFormId` to the `GeneralFormResponse` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('Text', 'Integer', 'Float', 'Date', 'Select', 'Textarea');

-- DropForeignKey
ALTER TABLE "CaseFormResponse" DROP CONSTRAINT "CaseFormResponse_caseformDefinitionId_fkey";

-- DropForeignKey
ALTER TABLE "GeneralFormResponse" DROP CONSTRAINT "GeneralFormResponse_generalFormDefinitionId_fkey";

-- AlterTable
ALTER TABLE "CaseFormResponse" DROP COLUMN "caseformDefinitionId",
DROP COLUMN "response",
ADD COLUMN     "caseFormId" TEXT;

-- AlterTable
ALTER TABLE "ClosingDocumentation" DROP COLUMN "response";

-- AlterTable
ALTER TABLE "ContactDocumentation" DROP COLUMN "response",
ADD COLUMN     "artDerBetreuung" TEXT NOT NULL,
ADD COLUMN     "beratungsThemenAllgemein" TEXT[],
ADD COLUMN     "beratungsThemenEltern" TEXT[],
ADD COLUMN     "beratungsThemenKinder" TEXT[],
ADD COLUMN     "dokumentation" TEXT,
ADD COLUMN     "duration" INTEGER NOT NULL,
ADD COLUMN     "zusammenfassung" TEXT;

-- AlterTable
ALTER TABLE "GeneralFormResponse" DROP COLUMN "generalFormDefinitionId",
DROP COLUMN "response",
ADD COLUMN     "generalFormId" TEXT NOT NULL;

-- DropTable
DROP TABLE "CaseFormDefinition";

-- DropTable
DROP TABLE "GeneralFormDefinition";

-- CreateTable
CREATE TABLE "CaseForm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CaseFormType" NOT NULL,
    "containsPersonalData" BOOLEAN NOT NULL DEFAULT true,
    "isPersonal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CaseForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneralForm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "GeneralForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "required" BOOLEAN,
    "text" TEXT NOT NULL,
    "selectOptions" JSONB[],
    "multiple" BOOLEAN,
    "min" DOUBLE PRECISION,
    "max" DOUBLE PRECISION,
    "textAreaRows" INTEGER,
    "caseFormId" TEXT,
    "generalFormId" TEXT,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerBool" BOOLEAN,
    "answerDate" TIMESTAMP(3),
    "answerInt" INTEGER,
    "answerNum" DOUBLE PRECISION,
    "answerSelectId" INTEGER[],
    "answerText" TEXT,
    "caseFormResponseId" TEXT,
    "closingDocumentationId" TEXT,
    "generalFormResponseId" TEXT,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CaseFormResponse" ADD CONSTRAINT "CaseFormResponse_caseFormId_fkey" FOREIGN KEY ("caseFormId") REFERENCES "CaseForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneralFormResponse" ADD CONSTRAINT "GeneralFormResponse_generalFormId_fkey" FOREIGN KEY ("generalFormId") REFERENCES "GeneralForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_caseFormId_fkey" FOREIGN KEY ("caseFormId") REFERENCES "CaseForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_generalFormId_fkey" FOREIGN KEY ("generalFormId") REFERENCES "GeneralForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_caseFormResponseId_fkey" FOREIGN KEY ("caseFormResponseId") REFERENCES "CaseFormResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_closingDocumentationId_fkey" FOREIGN KEY ("closingDocumentationId") REFERENCES "ClosingDocumentation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_generalFormResponseId_fkey" FOREIGN KEY ("generalFormResponseId") REFERENCES "GeneralFormResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
