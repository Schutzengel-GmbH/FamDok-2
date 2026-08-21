/*
  Warnings:

  - The `beratungsThemenAllgemein` column on the `ContactDocumentation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `beratungsThemenEltern` column on the `ContactDocumentation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `beratungsThemenKinder` column on the `ContactDocumentation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `artDerBetreuung` on the `ContactDocumentation` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "ContactDocumentation" DROP COLUMN "artDerBetreuung",
ADD COLUMN     "artDerBetreuung" INTEGER NOT NULL,
DROP COLUMN "beratungsThemenAllgemein",
ADD COLUMN     "beratungsThemenAllgemein" INTEGER[],
DROP COLUMN "beratungsThemenEltern",
ADD COLUMN     "beratungsThemenEltern" INTEGER[],
DROP COLUMN "beratungsThemenKinder",
ADD COLUMN     "beratungsThemenKinder" INTEGER[];
