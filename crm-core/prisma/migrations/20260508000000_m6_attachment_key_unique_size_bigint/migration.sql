-- AlterTable
ALTER TABLE "Attachment" ALTER COLUMN "size" SET DATA TYPE BIGINT;

-- AddUniqueConstraint
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_tenantId_key_key" UNIQUE ("tenantId", "key");
