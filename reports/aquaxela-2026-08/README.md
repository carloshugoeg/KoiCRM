# Reporte estadístico de uso — AquaXela (jun–ago 2026)

Reporte de 10 páginas sobre el uso real de Koi CRM por parte del tenant **AquaXela**,
con gráficas, lectura de los hallazgos y usos accionables de la data.

**Entregable:** [`Reporte-Uso-AquaXela-2026-08.pdf`](./Reporte-Uso-AquaXela-2026-08.pdf)

## Contenido

| Pág. | Sección |
|---|---|
| — | Portada |
| 1 | Resumen ejecutivo · seis hallazgos · acciones por tipo |
| 2 | Adopción: actividad semanal, operadores activos, hora del día, ritmo diario |
| 3 | Uso por operador: volumen, composición del uso, perfil individual |
| 4 | Resultados por operador: ganados, tasa de cierre, valor, higiene del proceso |
| 5 | Embudo, canales de entrada y velocidad de cierre |
| 6 | Calidad del dato, trazabilidad documental y cartera |
| 7 | Qué vende AquaXela según su propia data |
| 8 | En qué se puede usar esta data (5 frentes accionables) |
| 9 | Panel de control sugerido y prioridades a 30 días |

## Cómo regenerarlo

```bash
cd reports/aquaxela-2026-08
node build.mjs                                    # data.mjs + charts.mjs -> reporte.html
/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
  --print-to-pdf=Reporte-Uso-AquaXela-2026-08.pdf reporte.html
```

- `data.mjs` — snapshot de las cifras extraídas de Supabase. Para actualizar el reporte
  con un nuevo corte, se reejecutan las consultas de abajo y se reemplazan estos valores.
- `charts.mjs` — helpers de SVG (barras, líneas, embudo, tablas teñidas) sin dependencias.
  Paleta categórica validada para daltonismo con `scripts/validate_palette.js` de la skill
  `dataviz`: todas las gráficas llevan etiqueta directa, así que el color nunca es el único
  canal de información.
- `build.mjs` — composición de páginas y CSS de impresión (Letter, 8.5×11 in).

Las páginas son secciones de altura fija (`11in`, `overflow: hidden`); si se agrega
contenido hay que verificar visualmente que no se recorte, tomando captura de cada
página con Chromium a `816×1056`.

## Fuente de los datos

- Proyecto Supabase: `koi-crm-prod` (`rjvabiqiwxugnbhrstal`)
- Tenant: `AquaXela` — `cmq12wvdz0000nm0yuaoz2w7e`
- Fecha de corte: **2026-08-08**
- Ventana de actividad: **2026-06-08 → 2026-08-07** (61 días de calendario, 43 con actividad)
- Se analizó la totalidad de los registros del tenant, sin muestreo.

### Definiciones

- **Acción**: fila de `Activity` del tenant. Tipos: `created`, `stageChanged`, `quoteAdded`,
  `paymentAdded`, `followUpAdded`, `followUpCompleted`, `noteAdded`, `valueChanged`,
  `ownerChanged`, `deleted`.
- **Tasa de cierre**: negocios en etapa `ganado` sobre negocios *asignados* al operador
  (no sobre negocios trabajados).
- **Tiempo a cierre**: entre `Deal.createdAt` y el primer `stageChanged` con
  `payload->>'toLabel' = 'Ganado'`.
- **Valor**: campo `Deal.value` tal como lo capturó el operador. En los 87 negocios donde
  está en cero el valor real es desconocido y **no se imputó**.
- Las horas se convirtieron a GMT-6 (`createdAt - interval '6 hours'`).

### Consultas principales

Todas filtran por `"tenantId" = 'cmq12wvdz0000nm0yuaoz2w7e'`.

```sql
-- Actividad por operador
select coalesce(u.name,'(sistema)') as usuario, m.role::text as rol,
       count(a.*) as acciones,
       count(distinct a."createdAt"::date) as dias_activos,
       min(a."createdAt")::date as primer_dia, max(a."createdAt")::date as ultimo_dia
from "Activity" a
left join "User" u on u.id = a."userId"
left join "Membership" m on m."userId" = a."userId" and m."tenantId" = a."tenantId"
where a."tenantId" = 'cmq12wvdz0000nm0yuaoz2w7e'
group by 1,2 order by acciones desc;

-- Mix de acciones por operador (composición del uso)
select coalesce(u.name,'?') as usuario, a.type, count(*) as n
from "Activity" a left join "User" u on u.id = a."userId"
where a."tenantId" = 'cmq12wvdz0000nm0yuaoz2w7e'
group by 1,2 order by 1,3 desc;

-- Serie semanal de adopción
select date_trunc('week', a."createdAt")::date as semana,
       count(*) as acciones, count(distinct a."userId") as usuarios_activos,
       count(*) filter (where a.type = 'created')      as deals_creados,
       count(*) filter (where a.type = 'stageChanged') as cambios_etapa,
       count(*) filter (where a.type = 'quoteAdded')   as cotizaciones,
       count(*) filter (where a.type = 'paymentAdded') as pagos
from "Activity" a
where a."tenantId" = 'cmq12wvdz0000nm0yuaoz2w7e'
group by 1 order by 1;

-- Resultados e higiene del proceso por operador
select coalesce(u.name,'(sin dueño)') as usuario,
       count(*) as deals,
       count(*) filter (where s.key = 'ganado')  as ganados,
       count(*) filter (where s.key = 'perdido') as perdidos,
       round(sum(d.value) filter (where s.key = 'ganado')::numeric, 2) as valor_ganado,
       round(sum(d.value) filter (where s.key not in ('ganado','perdido'))::numeric, 2) as valor_abierto,
       count(*) filter (where d.value is null or d.value = 0) as sin_valor,
       count(*) filter (where exists (select 1 from "Quote"      q  where q."dealId"  = d.id and not q."isVoid")) as con_cotizacion,
       count(*) filter (where exists (select 1 from "Payment"    p  where p."dealId"  = d.id and not p."isVoid")) as con_pago,
       count(*) filter (where exists (select 1 from "FollowUp"   f  where f."dealId"  = d.id)) as con_seguimiento,
       count(*) filter (where exists (select 1 from "Note"       n  where n."dealId"  = d.id)) as con_nota,
       count(*) filter (where exists (select 1 from "Attachment" at where at."dealId" = d.id)) as con_adjunto
from "Deal" d
left join "User" u on u.id = d."ownerId"
left join "PipelineStage" s on s.id = d."stageId"
where d."tenantId" = 'cmq12wvdz0000nm0yuaoz2w7e'
group by 1 order by deals desc;

-- Embudo al corte
select s."order", s.key, s.label, count(d.id) as deals,
       round(sum(d.value)::numeric, 2) as valor,
       round(avg(extract(epoch from (now() - d."stageEnteredAt")) / 86400)::numeric, 1) as dias_prom_en_etapa
from "PipelineStage" s
left join "Deal" d on d."stageId" = s.id and d."isArchived" = false
where s."tenantId" = 'cmq12wvdz0000nm0yuaoz2w7e'
group by 1,2,3 order by s."order";

-- Canales de entrada y su tasa de cierre
select coalesce(d."channelKey", '(sin canal)') as canal, count(*) as deals,
       round(sum(d.value)::numeric, 2) as valor,
       count(*) filter (where s.key = 'ganado') as ganados,
       round(100.0 * count(*) filter (where s.key = 'ganado') / count(*), 1) as pct_ganado
from "Deal" d left join "PipelineStage" s on s.id = d."stageId"
where d."tenantId" = 'cmq12wvdz0000nm0yuaoz2w7e'
group by 1 order by deals desc;

-- Tiempo entre crear el negocio y cerrarlo
with w as (
  select d.id, d."createdAt",
         (select min(a."createdAt") from "Activity" a
           where a."entityId" = d.id and a.type = 'stageChanged'
             and a.payload->>'toLabel' = 'Ganado') as won_at
  from "Deal" d join "PipelineStage" s on s.id = d."stageId"
  where d."tenantId" = 'cmq12wvdz0000nm0yuaoz2w7e' and s.key = 'ganado')
select case
         when extract(epoch from (won_at - "createdAt")) / 60   < 5  then 'a) < 5 min'
         when extract(epoch from (won_at - "createdAt")) / 3600 < 1  then 'b) 5-60 min'
         when extract(epoch from (won_at - "createdAt")) / 3600 < 24 then 'c) mismo dia'
         when extract(epoch from (won_at - "createdAt")) / 86400 < 7 then 'd) 1-7 dias'
         else 'e) > 7 dias' end as rango,
       count(*) as deals
from w group by 1 order by 1;

-- Antigüedad del pipeline abierto (último toque real, incluida la bitácora de actividad)
with abiertos as (
  select d.id, d.value, coalesce(u.name,'?') as usuario,
         greatest(d."updatedAt", d."stageEnteredAt",
                  coalesce((select max(a."createdAt") from "Activity" a where a."entityId" = d.id),
                           d."createdAt")) as ultimo_toque
  from "Deal" d
  join "PipelineStage" s on s.id = d."stageId"
  left join "User" u on u.id = d."ownerId"
  where d."tenantId" = 'cmq12wvdz0000nm0yuaoz2w7e'
    and s.key not in ('ganado','perdido') and d."isArchived" = false)
select case
         when extract(epoch from (now() - ultimo_toque)) / 86400 < 7  then 'a) 0-7 dias'
         when extract(epoch from (now() - ultimo_toque)) / 86400 < 15 then 'b) 8-14 dias'
         when extract(epoch from (now() - ultimo_toque)) / 86400 < 30 then 'c) 15-29 dias'
         else 'd) 30+ dias (frio)' end as antiguedad,
       count(*) as deals, round(sum(value)::numeric, 2) as valor
from abiertos group by 1 order by 1;
```

Las consultas restantes (seguimientos, calidad de campos, cartera, categorías de equipo,
documentos y horas del día) siguen el mismo patrón y sus resultados están volcados en
`data.mjs`.

## Nota de seguridad detectada al consultar la base

El asesor de Supabase reporta que **13 tablas del esquema `public` tienen RLS deshabilitado**
(`Tenant`, `User`, `Membership`, `TenantBranding`, `TenantSettings`, `IndustryTemplate`,
`Account`, `Session`, `VerificationToken`, `Invitation`, `JoinLink`, `rate_limit_entries`,
`_prisma_migrations`). Con la clave anónima esas tablas quedan legibles y escribibles.
No se aplicó ningún cambio: habilitar RLS sin políticas bloquearía todo el acceso, así que
la remediación debe diseñarse aparte, tabla por tabla.
