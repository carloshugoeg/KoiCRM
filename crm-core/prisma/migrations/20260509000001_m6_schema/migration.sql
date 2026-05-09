-- M6 squashed migration — correct dependency order
-- (was split across 3 migrations applied out of order; consolidated here)

-- AlterTable: TenantSettings — add storage + file-size limits
ALTER TABLE "TenantSettings" ADD COLUMN "fileSizeMaxBytes" BIGINT NOT NULL DEFAULT 104857600;
ALTER TABLE "TenantSettings" ADD COLUMN "storageMaxBytes"  BIGINT NOT NULL DEFAULT 8589934592;
ALTER TABLE "TenantSettings" ADD COLUMN "storageUsedBytes" BIGINT NOT NULL DEFAULT 0;

-- AlterTable: Attachment — add key column FIRST (required before unique constraint)
ALTER TABLE "Attachment" ADD COLUMN "key" TEXT NOT NULL DEFAULT '';
-- Change size from Int to BigInt
ALTER TABLE "Attachment" ALTER COLUMN "size" SET DATA TYPE BIGINT;
-- AddUniqueConstraint on (tenantId, key) — only valid after key column exists
CREATE UNIQUE INDEX "Attachment_tenantId_key_key" ON "Attachment"("tenantId", "key");

-- AlterTable: PipelineStage — add alert flags
ALTER TABLE "PipelineStage" ADD COLUMN "requiresPayment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PipelineStage" ADD COLUMN "requiresQuote"   BOOLEAN NOT NULL DEFAULT false;
