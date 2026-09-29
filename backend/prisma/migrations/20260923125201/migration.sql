-- AlterEnum
ALTER TYPE "Familienstand" ADD VALUE 'verwitwet';

-- AlterTable
ALTER TABLE "ContactDocumentation" ADD COLUMN     "end" TIMESTAMP(3),
ADD COLUMN     "start" TIMESTAMP(3);
