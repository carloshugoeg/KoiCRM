-- Fix wrong catalog keys seeded by old registry
UPDATE "CatalogItem" SET "catalogKey" = 'salesChannel' WHERE "catalogKey" = 'channel';
UPDATE "CatalogItem" SET "catalogKey" = 'dealStatus'   WHERE "catalogKey" = 'status';

-- Backfill followupReason for existing aquasistemas tenants
INSERT INTO "CatalogItem" (id, "tenantId", "catalogKey", key, label, color, "order")
SELECT
  gen_random_uuid()::text,
  t.id,
  'followupReason',
  u.key, u.label, NULL, u.ord
FROM "Tenant" t
CROSS JOIN (VALUES
  ('no_responde',        'No responde',          0),
  ('pide_informacion',   'Pide más información', 1),
  ('necesita_tiempo',    'Necesita tiempo',      2),
  ('revisar_cotizacion', 'Revisar cotización',   3),
  ('agendar_visita',     'Agendar visita',       4),
  ('otro',               'Otro',                 5)
) AS u(key, label, ord)
WHERE t."industrySlug" = 'aquasistemas'
  AND NOT EXISTS (
    SELECT 1 FROM "CatalogItem" ci
    WHERE ci."tenantId" = t.id AND ci."catalogKey" = 'followupReason' AND ci.key = u.key
  );
