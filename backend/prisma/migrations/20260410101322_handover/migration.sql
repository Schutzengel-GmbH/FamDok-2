-- CreateTable
CREATE TABLE "public"."Handover" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "addedIds" TEXT[],
    "removedIds" TEXT[],
    "notes" TEXT,

    CONSTRAINT "Handover_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Handover" ADD CONSTRAINT "Handover_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "public"."Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
