-- T2.3: Row-Level Security policies for all tenant-scoped business tables.
-- Applied via: prisma migrate dev --create-only --name rls
-- Then copy this content into the generated migration.sql

-- Pipeline
ALTER TABLE "Pipeline" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Pipeline"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- PipelineStage
ALTER TABLE "PipelineStage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PipelineStage"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- CatalogItem
ALTER TABLE "CatalogItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CatalogItem"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Client
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Client"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Deal
ALTER TABLE "Deal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Deal"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Quote
ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Quote"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Payment
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Payment"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Attachment
ALTER TABLE "Attachment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Attachment"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- FollowUp
ALTER TABLE "FollowUp" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "FollowUp"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Note
ALTER TABLE "Note" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Note"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Activity
ALTER TABLE "Activity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Activity"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- SavedView
ALTER TABLE "SavedView" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SavedView"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Counter
ALTER TABLE "Counter" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Counter"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- CustomFieldDefinition
ALTER TABLE "CustomFieldDefinition" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CustomFieldDefinition"
  USING ("tenantId" = current_setting('app.tenant_id', true));
