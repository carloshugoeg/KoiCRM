-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "subscriptionValidated" BOOLEAN NOT NULL DEFAULT false;

-- Existing workspaces keep embudo access until explicitly deactivated
UPDATE "Tenant" SET "subscriptionValidated" = true;
