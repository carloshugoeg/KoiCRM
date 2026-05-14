-- CreateIndex
CREATE INDEX IF NOT EXISTS "Deal_tenantId_createdAt_idx" ON "Deal"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Deal_tenantId_channelKey_idx" ON "Deal"("tenantId", "channelKey");
