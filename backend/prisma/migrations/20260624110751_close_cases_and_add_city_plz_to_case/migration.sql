-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "city" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closingDocId" TEXT,
ADD COLUMN     "plz" TEXT;
