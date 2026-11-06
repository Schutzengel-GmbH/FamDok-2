-- Drops the plaintext personal-data columns that the org encryption replaced with encrypted
-- blobs (Family/Child/Caregiver."encrypted"). Apply only once EVERY organisation has set up its
-- encryption and finished "Bestandsdaten verschlüsseln" - see ../README.md.
--
-- The checks below abort the migration (and roll it back) if any row still holds plaintext, so
-- running it too early cannot destroy data.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Organisation" WHERE "keyState" = 'uninitialized') THEN
    RAISE EXCEPTION 'Some organisations have not set up their encryption yet';
  END IF;
  IF EXISTS (SELECT 1 FROM "Family" WHERE "encrypted" IS NULL AND "name" IS NOT NULL) THEN
    RAISE EXCEPTION 'Family rows still hold plaintext - run the migration in every organisation first';
  END IF;
  IF EXISTS (SELECT 1 FROM "Child" WHERE "encrypted" IS NULL AND "name" IS NOT NULL) THEN
    RAISE EXCEPTION 'Child rows still hold plaintext - run the migration in every organisation first';
  END IF;
  IF EXISTS (SELECT 1 FROM "Caregiver" WHERE "encrypted" IS NULL AND "name" IS NOT NULL) THEN
    RAISE EXCEPTION 'Caregiver rows still hold plaintext - run the migration in every organisation first';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "ContactDocumentation"
    WHERE ("zusammenfassung" IS NOT NULL AND "zusammenfassung" NOT LIKE 'v1.%')
       OR ("dokumentation" IS NOT NULL AND "dokumentation" NOT LIKE 'v1.%')
  ) THEN
    RAISE EXCEPTION 'Contact documentation still holds plaintext';
  END IF;
  IF EXISTS (SELECT 1 FROM "Zielvereinbarung" WHERE "description" NOT LIKE 'v1.%') THEN
    RAISE EXCEPTION 'Zielvereinbarung descriptions still hold plaintext';
  END IF;
  IF EXISTS (SELECT 1 FROM "Handover" WHERE "notes" IS NOT NULL AND "notes" NOT LIKE 'v1.%') THEN
    RAISE EXCEPTION 'Handover notes still hold plaintext';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Case"
    WHERE "specificMigrationBackground" IS NOT NULL AND "specificMigrationBackground" NOT LIKE 'v1.%'
  ) THEN
    RAISE EXCEPTION 'Case.specificMigrationBackground still holds plaintext';
  END IF;
  IF EXISTS (SELECT 1 FROM "CaseAttachment" WHERE "contentKeyVersion" IS NULL OR "filename" NOT LIKE 'v1.%') THEN
    RAISE EXCEPTION 'Case attachments are not all encrypted yet';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Family" DROP COLUMN "name",
DROP COLUMN "note",
DROP COLUMN "adress",
DROP COLUMN "phone",
DROP COLUMN "additionalPhones";

-- AlterTable
ALTER TABLE "Child" DROP COLUMN "name",
DROP COLUMN "lastName",
DROP COLUMN "gender",
DROP COLUMN "dateOfBirth",
DROP COLUMN "healthData";

-- AlterTable
ALTER TABLE "Caregiver" DROP COLUMN "name",
DROP COLUMN "lastName",
DROP COLUMN "relation",
DROP COLUMN "gender",
DROP COLUMN "dateOfBirth";
