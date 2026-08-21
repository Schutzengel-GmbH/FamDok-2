-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('Admin', 'Controller', 'OrgController', 'User');

-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('inProgress', 'done', 'failed');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('male', 'female', 'other', 'unspecified');

-- CreateEnum
CREATE TYPE "public"."Familienstand" AS ENUM ('ledig', 'verheiratet', 'geschieden', 'unspecified');

-- CreateEnum
CREATE TYPE "public"."Relation" AS ENUM ('mother', 'father', 'grandparent', 'partner', 'other');

-- CreateEnum
CREATE TYPE "public"."CaseFormType" AS ENUM ('single', 'multiple');

-- CreateTable
CREATE TABLE "public"."Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubOrganisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,

    CONSTRAINT "SubOrganisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Family" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "name" TEXT NOT NULL,
    "adress" JSONB,
    "phone" TEXT,
    "additionalPhones" TEXT[],

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Child" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT,
    "gender" "public"."Gender" NOT NULL DEFAULT 'unspecified',
    "dateOfBirth" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Caregiver" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT,
    "relation" "public"."Relation" NOT NULL,
    "gender" "public"."Gender" NOT NULL DEFAULT 'unspecified',
    "dateOfBirth" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Caregiver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CaseFormDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."CaseFormType" NOT NULL,
    "containsPersonalData" BOOLEAN NOT NULL DEFAULT true,
    "definition" JSONB NOT NULL,

    CONSTRAINT "CaseFormDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CaseFormResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "caseId" TEXT NOT NULL,
    "caseformDefinitionId" TEXT NOT NULL,
    "response" JSONB NOT NULL,

    CONSTRAINT "CaseFormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Case" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "migrationBackground" BOOLEAN,
    "specificMigrationBackground" TEXT,
    "familienstand" "public"."Familienstand",
    "partnerInvolved" BOOLEAN,
    "bekanntJA" BOOLEAN,
    "familyId" TEXT NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Zielvereinbarung" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishBy" TIMESTAMP(3) NOT NULL,
    "status" "public"."Status" NOT NULL DEFAULT 'inProgress',
    "topic" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "caseId" TEXT,

    CONSTRAINT "Zielvereinbarung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "kcId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "public"."Role" NOT NULL,
    "jobTitle" TEXT,
    "organisationId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_SubOrganisationToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SubOrganisationToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_responsibleUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_responsibleUsers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_kcId_key" ON "public"."User"("kcId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "_SubOrganisationToUser_B_index" ON "public"."_SubOrganisationToUser"("B");

-- CreateIndex
CREATE INDEX "_responsibleUsers_B_index" ON "public"."_responsibleUsers"("B");

-- AddForeignKey
ALTER TABLE "public"."SubOrganisation" ADD CONSTRAINT "SubOrganisation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "public"."Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Family" ADD CONSTRAINT "Family_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "public"."Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Child" ADD CONSTRAINT "Child_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "public"."Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Caregiver" ADD CONSTRAINT "Caregiver_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "public"."Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CaseFormResponse" ADD CONSTRAINT "CaseFormResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CaseFormResponse" ADD CONSTRAINT "CaseFormResponse_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "public"."Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CaseFormResponse" ADD CONSTRAINT "CaseFormResponse_caseformDefinitionId_fkey" FOREIGN KEY ("caseformDefinitionId") REFERENCES "public"."CaseFormDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Case" ADD CONSTRAINT "Case_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Case" ADD CONSTRAINT "Case_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "public"."Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Zielvereinbarung" ADD CONSTRAINT "Zielvereinbarung_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Zielvereinbarung" ADD CONSTRAINT "Zielvereinbarung_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "public"."Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "public"."Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_SubOrganisationToUser" ADD CONSTRAINT "_SubOrganisationToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."SubOrganisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_SubOrganisationToUser" ADD CONSTRAINT "_SubOrganisationToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_responsibleUsers" ADD CONSTRAINT "_responsibleUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_responsibleUsers" ADD CONSTRAINT "_responsibleUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
