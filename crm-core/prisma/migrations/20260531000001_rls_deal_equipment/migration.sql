-- DealEquipment has no tenantId but is a child of Deal (which has RLS).
-- A JOIN-based policy ensures only equipment rows belonging to accessible deals are visible.
ALTER TABLE "DealEquipment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DealEquipment"
  USING (EXISTS (
    SELECT 1 FROM "Deal" d
    WHERE d.id = "DealEquipment"."dealId"
      AND d."tenantId" = current_setting('app.tenant_id', true)
  ));

-- Grant new table permissions to app_user (policy applies automatically)
GRANT SELECT, INSERT, UPDATE, DELETE ON "DealEquipment" TO app_user;
