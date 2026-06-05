-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPERVISOR';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "createdById" TEXT;

-- CreateTable
CREATE TABLE "DealViewer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealViewer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealViewer_tenantId_userId_idx" ON "DealViewer"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DealViewer_dealId_userId_key" ON "DealViewer"("dealId", "userId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealViewer" ADD CONSTRAINT "DealViewer_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealViewer" ADD CONSTRAINT "DealViewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security: tenant isolation for DealViewer (read-only cesión grants)
ALTER TABLE "DealViewer" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DealViewer"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Grant new table permissions to app_user (policy applies automatically)
GRANT SELECT, INSERT, UPDATE, DELETE ON "DealViewer" TO app_user;
