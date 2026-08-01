-- CreateTable
CREATE TABLE "RolePermission" (
    "tenantId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "key" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("tenantId","role","key")
);

-- CreateIndex
CREATE INDEX "RolePermission_tenantId_idx" ON "RolePermission"("tenantId");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: RolePermission is tenant-scoped like every other business table.
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "RolePermission"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Grant new table permissions to app_user (policy applies automatically)
GRANT SELECT, INSERT, UPDATE, DELETE ON "RolePermission" TO app_user;

-- Compatibility backfill. Workspaces that already exist ran an open funnel: every member
-- saw every deal. The new MEMBER default is restricted, so pin the previous behaviour for
-- them. Workspaces created after this migration have no row here and get the restricted
-- default. Deliberately does NOT backfill pipeline.viewTotals — money aggregates are what
-- the restriction is for.
INSERT INTO "RolePermission" ("tenantId", "role", "key", "allowed", "updatedAt")
SELECT "id", 'MEMBER', 'pipeline.viewAll', true, NOW() FROM "Tenant";
