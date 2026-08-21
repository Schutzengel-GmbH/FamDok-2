-- CreateTable
CREATE TABLE "public"."GeneralFormDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" JSONB NOT NULL,

    CONSTRAINT "GeneralFormDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GeneralFormResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "generalFormDefinitionId" TEXT NOT NULL,
    "response" JSONB NOT NULL,

    CONSTRAINT "GeneralFormResponse_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."GeneralFormResponse" ADD CONSTRAINT "GeneralFormResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GeneralFormResponse" ADD CONSTRAINT "GeneralFormResponse_generalFormDefinitionId_fkey" FOREIGN KEY ("generalFormDefinitionId") REFERENCES "public"."GeneralFormDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
