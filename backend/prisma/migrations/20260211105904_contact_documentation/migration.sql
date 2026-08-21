-- CreateTable
CREATE TABLE "public"."ContactDocumentation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "caseId" TEXT NOT NULL,
    "response" JSONB NOT NULL,

    CONSTRAINT "ContactDocumentation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."ContactDocumentation" ADD CONSTRAINT "ContactDocumentation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContactDocumentation" ADD CONSTRAINT "ContactDocumentation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "public"."Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
