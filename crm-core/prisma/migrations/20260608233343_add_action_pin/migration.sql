-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "actionPinHash" TEXT;

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "pinEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinUnlockWindowSeconds" INTEGER NOT NULL DEFAULT 300;

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_actionPinHash_key" ON "Membership"("tenantId", "actionPinHash");
