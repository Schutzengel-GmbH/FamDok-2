-- CreateTable
CREATE TABLE "Setting" (
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "ClosingDocumentation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "caseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "response" JSONB NOT NULL,

    CONSTRAINT "ClosingDocumentation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setting_name_key" ON "Setting"("name");

-- AddForeignKey
ALTER TABLE "ClosingDocumentation" ADD CONSTRAINT "ClosingDocumentation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosingDocumentation" ADD CONSTRAINT "ClosingDocumentation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
