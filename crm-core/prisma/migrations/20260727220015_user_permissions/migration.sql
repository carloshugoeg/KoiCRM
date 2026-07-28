-- CreateTable
CREATE TABLE "UserPermission" (
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("tenantId","userId","key")
);

-- CreateIndex
CREATE INDEX "UserPermission_tenantId_idx" ON "UserPermission"("tenantId");

-- CreateIndex
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: UserPermission is tenant-scoped like every other business table.
ALTER TABLE "UserPermission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "UserPermission"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Grant new table permissions to app_user (policy applies automatically)
GRANT SELECT, INSERT, UPDATE, DELETE ON "UserPermission" TO app_user;
