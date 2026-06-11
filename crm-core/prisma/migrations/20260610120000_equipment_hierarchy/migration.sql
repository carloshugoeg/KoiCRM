-- Equipo de interés → categoría / subcategoría (2-level taxonomy).
--
-- CatalogItem gains a self-FK (parentId): for catalogKey 'equipment', parentId NULL = categoría,
-- parentId set = subcategoría. DealEquipment now stores the selected subcategoría plus its
-- denormalized categoría key.
--
-- Per product decision the existing flat equipment data is WIPED and reseeded fresh, so no
-- backfill is needed and the new NOT NULL columns apply cleanly on an empty table.
--
-- RLS: no policy changes. CatalogItem and DealEquipment already have policies + grants
-- (20260502213914_rls, 20260531000001_rls_deal_equipment). The self-FK adds no new table and the
-- DealEquipment policy keys on dealId only.

-- 1. CatalogItem: self-FK for the categoría → subcategoría tree
ALTER TABLE "CatalogItem" ADD COLUMN "parentId" TEXT;
ALTER TABLE "CatalogItem"
  ADD CONSTRAINT "CatalogItem_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "CatalogItem_parentId_idx" ON "CatalogItem"("parentId");

-- 2. Wipe existing equipment data (owner decision: reseed fresh).
--    DealEquipment only ever stores equipment links, so it is fully cleared.
DELETE FROM "DealEquipment";
DELETE FROM "CatalogItem" WHERE "catalogKey" = 'equipment';

-- 3. DealEquipment: restructure (clean, since the table is now empty)
ALTER TABLE "DealEquipment" DROP CONSTRAINT "DealEquipment_pkey";
ALTER TABLE "DealEquipment" DROP COLUMN "equipmentKey";
ALTER TABLE "DealEquipment" DROP COLUMN "customLabel";
ALTER TABLE "DealEquipment" ADD COLUMN "categoryKey" TEXT NOT NULL;
ALTER TABLE "DealEquipment" ADD COLUMN "subcategoryKey" TEXT NOT NULL;
ALTER TABLE "DealEquipment" ADD CONSTRAINT "DealEquipment_pkey" PRIMARY KEY ("dealId", "subcategoryKey");
CREATE INDEX "DealEquipment_categoryKey_idx" ON "DealEquipment"("categoryKey");
