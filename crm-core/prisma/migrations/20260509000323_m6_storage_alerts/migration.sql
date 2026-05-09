/*
  Warnings:

  - Added the required column `key` to the `Attachment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "key" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PipelineStage" ADD COLUMN     "requiresPayment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresQuote" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "storageMaxBytes" BIGINT NOT NULL DEFAULT 8589934592,
ADD COLUMN     "storageUsedBytes" BIGINT NOT NULL DEFAULT 0;
