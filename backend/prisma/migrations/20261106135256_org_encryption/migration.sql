-- CreateEnum
CREATE TYPE "OrgKeyState" AS ENUM ('uninitialized', 'active', 'frozen', 'rotating');

-- CreateEnum
CREATE TYPE "OrgKeyEventType" AS ENUM ('setup', 'enrol', 'reenrol', 'passphraseChanged', 'grant', 'revoke', 'recovery', 'freeze', 'unfreeze', 'rotationStarted', 'rotationCompleted');

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "answerEncrypted" TEXT;

-- AlterTable
ALTER TABLE "Caregiver" ADD COLUMN     "encrypted" TEXT,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "relation" DROP NOT NULL,
ALTER COLUMN "gender" DROP NOT NULL,
ALTER COLUMN "gender" DROP DEFAULT,
ALTER COLUMN "dateOfBirth" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CaseAttachment" ADD COLUMN     "contentKeyVersion" INTEGER;

-- AlterTable
ALTER TABLE "Child" ADD COLUMN     "encrypted" TEXT,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "gender" DROP NOT NULL,
ALTER COLUMN "gender" DROP DEFAULT,
ALTER COLUMN "dateOfBirth" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "encrypted" TEXT,
ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "frozenAt" TIMESTAMP(3),
ADD COLUMN     "keyState" "OrgKeyState" NOT NULL DEFAULT 'uninitialized',
ADD COLUMN     "keyVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pendingKeyVersion" INTEGER,
ADD COLUMN     "recoveryWrappedKey" TEXT;

-- CreateTable
CREATE TABLE "UserKey" (
    "userId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "wrappedPrivateKey" TEXT NOT NULL,
    "kdfParams" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserKey_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "OrgKeyGrant" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT,
    "keyVersion" INTEGER NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgKeyGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgKeyEvent" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "type" "OrgKeyEventType" NOT NULL,
    "actorId" TEXT,
    "subjectId" TEXT,
    "keyVersion" INTEGER,
    "fingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgKeyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgKeyGrant_organisationId_userId_keyVersion_key" ON "OrgKeyGrant"("organisationId", "userId", "keyVersion");

-- AddForeignKey
ALTER TABLE "UserKey" ADD CONSTRAINT "UserKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgKeyGrant" ADD CONSTRAINT "OrgKeyGrant_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgKeyGrant" ADD CONSTRAINT "OrgKeyGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgKeyGrant" ADD CONSTRAINT "OrgKeyGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgKeyEvent" ADD CONSTRAINT "OrgKeyEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgKeyEvent" ADD CONSTRAINT "OrgKeyEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgKeyEvent" ADD CONSTRAINT "OrgKeyEvent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
