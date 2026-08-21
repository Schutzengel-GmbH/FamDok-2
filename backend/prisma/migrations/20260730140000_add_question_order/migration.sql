-- AlterTable: add an explicit, independently-persisted position for each Question,
-- decoupling render/edit order from incidental row insertion order.
ALTER TABLE "Question" ADD COLUMN "order" INTEGER;

-- Backfill existing rows: preserve today's de-facto order (creation order via cuid)
-- per parent form, since cuids are lexicographically sortable by creation time.
UPDATE "Question" q
SET "order" = sub.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "caseFormId" ORDER BY id) AS rn
  FROM "Question"
  WHERE "caseFormId" IS NOT NULL
) sub
WHERE q.id = sub.id;

UPDATE "Question" q
SET "order" = sub.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "generalFormId" ORDER BY id) AS rn
  FROM "Question"
  WHERE "generalFormId" IS NOT NULL
) sub
WHERE q.id = sub.id;

ALTER TABLE "Question" ALTER COLUMN "order" SET NOT NULL;
