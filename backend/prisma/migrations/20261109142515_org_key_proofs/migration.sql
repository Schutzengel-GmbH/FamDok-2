-- CreateTable
CREATE TABLE "OrgKeyProof" (
    "organisationId" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "proof" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgKeyProof_pkey" PRIMARY KEY ("organisationId","keyVersion")
);

-- AddForeignKey
ALTER TABLE "OrgKeyProof" ADD CONSTRAINT "OrgKeyProof_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
