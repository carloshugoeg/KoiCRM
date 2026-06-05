# M6 — Quotes, Payments, Attachments — Design Spec

**Date:** 2026-05-08  
**Status:** Approved  
**Milestone:** M6 (follows M5 — Core CRM)

---

## Context

M5 delivered the full core CRM: pipeline kanban, deal/client CRUD, search, notes, activity log, archive, and print report. All deal cards and the DealDetail modal exist and work. M6 adds the financial layer on top: quotes (cotizaciones), payment receipts (comprobantes de pago), and the file upload infrastructure that backs both. It also wires the two business alerts ("Falta Cotización", "Falta Pago") into the pipeline card and print report.

---

## Scope

Three tasks in dependency order:

| Task | Deliverable |
|------|-------------|
| T6.1 | Cloudflare R2 upload infrastructure + per-tenant storage cap (configurable) |
| T6.2 | Quote CRUD + "Falta Cotización" alert |
| T6.3 | Payment CRUD + "Falta Pago" alert |

Storage reconciliation (nightly cron + manual recalculate) is **deferred to M10**.

---

## T6.1 — Upload Infrastructure

### Goal
Enable direct-to-R2 file uploads via signed URLs, with a configurable per-tenant storage cap enforced server-side.

### Files
- `lib/storage/s3.ts` — R2 client + helpers
- `app/api/upload/sign/route.ts` — sign endpoint
- `features/attachments/actions.ts` — confirm upload, delete attachment
- `features/attachments/schemas.ts` — Zod schemas
- `prisma/migrations/<ts>_storage_settings/migration.sql` — adds two fields to TenantSettings

### Data model changes
Add to `TenantSettings`:
```prisma
storageMaxBytes  BigInt @default(8589934592)  // 8 GB default, configurable per tenant
storageUsedBytes BigInt @default(0)           // running total, updated on upload/delete
```

The `Attachment` model already exists in `prisma/schema.prisma` with `id`, `tenantId`, `dealId?`, `clientId?`, `url`, `mimeType`, `size`, `createdAt`.

### Upload flow
1. Client POSTs `{ contentType, size, dealId }` to `/api/upload/sign`
2. Route handler: authenticate session → resolve tenant → check `storageUsedBytes + size <= storageMaxBytes`
   - If over limit → 403 `{ code: "storage_limit_exceeded", message: "No puedes agregar más cotizaciones/pagos, has excedido el límite de almacenamiento" }`
3. Generate S3 key: `${tenantId}/deals/${dealId}/${nanoid()}.${ext}`
4. Call `s3.signUploadUrl(key, contentType, size)` → returns `{ signedUrl, key, publicUrl }`
5. Client PUTs file directly to R2 using `signedUrl`
6. Client calls server action `confirmUpload({ dealId, key, url, mimeType, size })`:
   - Inserts `Attachment` row
   - Increments `TenantSettings.storageUsedBytes` atomically inside `withTenant()`

### Delete flow
`deleteAttachment(attachmentId)`:
- Verifies ownership (tenantId match)
- Calls `s3.deleteObject(key)`
- Deletes `Attachment` row
- Decrements `TenantSettings.storageUsedBytes` by `attachment.size`

### `lib/storage/s3.ts` exports
```ts
signUploadUrl(key: string, contentType: string, maxBytes: number): Promise<{ signedUrl: string; publicUrl: string }>
deleteObject(key: string): Promise<void>
```
Configured from env: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`.

### Constraints
- Max file size per upload: read from `TenantSettings.storageMaxBytes` — no single hardcoded limit
- Accepted MIME types: `image/*`, `application/pdf` (validated in sign route)
- Signed URL TTL: 5 minutes (sufficient for direct upload)

### Tests
- Unit: `signUploadUrl` generates correct presigned URL shape
- Integration: sign → upload → confirm → storage counter incremented; delete → counter decremented; over-limit → 403

---

## T6.2 — Quote CRUD + "Falta Cotización" Alert

### Goal
Manage multiple quotes per deal. Show an alert on the pipeline card and populate the print report alert column.

### Files
- `features/quotes/schemas.ts`
- `features/quotes/actions.ts`
- `features/quotes/queries.ts`
- `features/quotes/policies.ts`
- `features/quotes/components/QuoteSection.tsx`
- Updates to `features/pipeline/components/DealCard.tsx` (alert dot)
- Updates to `features/deals/components/DealDetailModal.tsx` (left panel)
- Updates to `features/deals/queries.ts` (include alert flags in deal queries)

### Data model
`Quote` already in schema: `id`, `tenantId`, `dealId`, `number`, `date`, `fileUrl?`, `isVoid`, `customData?`, `createdAt`.

### Server actions
All run inside `withTenant()`, all validate with Zod, all enforce RBAC:

| Action | Policy | Activity event |
|--------|--------|---------------|
| `createQuote({ dealId, number, date, fileUrl? })` | MEMBER+ | `quoteAdded { number }` |
| `updateQuote({ id, number, date, fileUrl? })` | MEMBER+ (own deal) / ADMIN+ (any) | — |
| `voidQuote({ id })` | MEMBER+ | — |
| `deleteQuote({ id })` | ADMIN+ | — |

### Alert logic
`hasQuoteAlert(deal: { stageKey: string; quotes: Quote[] }): boolean`
```
deal.stageKey ∈ { "contactado", "cotizacion", "negociacion", "ganado" }
AND quotes.filter(q => !q.isVoid).length === 0
```
Alert computed server-side in deal queries — never in the client.

### UI — QuoteSection (inside DealDetail left panel)
```
Cotizaciones
──────────────────────────────────────
COT-001   12 ene 2025   📎 ver   [Anular] [Eliminar]
COT-002   05 mar 2025   —        [Anulado]
──────────────────────────────────────
[+ Agregar cotización]
```
- Voided rows: strikethrough text + "Anulado" badge, no actions
- File link: opens R2 public URL in new tab
- "Agregar cotización" inline form: number (text), date (date picker), optional file picker (triggers T6.1 upload flow)
- File picker shows upload progress, then thumbnail or PDF icon on success

### Alert on pipeline card
Add to existing `DealCard`: if `deal.hasQuoteAlert || deal.hasPaymentAlert`, render a pulsing red dot (Tailwind `animate-ping`) in top-right corner of card. Tooltip on hover: list active alert names.

### Tests
- Integration: create quote → alert disappears; void all quotes → alert reappears; stage = "prospecto" → no alert regardless
- Integration: MEMBER cannot delete; ADMIN can
- E2E: open DealDetail → add quote → see it in list → void it → alert dot appears on card

---

## T6.3 — Payment CRUD + "Falta Pago" Alert

### Goal
Mirror of T6.2 for payment receipts (comprobantes de pago).

### Files
- `features/payments/schemas.ts`
- `features/payments/actions.ts`
- `features/payments/queries.ts`
- `features/payments/policies.ts`
- `features/payments/components/PaymentSection.tsx`
- Updates to `features/deals/queries.ts` (include `hasPaymentAlert`)
- Updates to `features/deals/components/DealDetailModal.tsx` (left panel, below QuoteSection)

### Data model
`Payment` already in schema: `id`, `tenantId`, `dealId`, `number`, `date`, `fileUrl?`, `isVoid`, `customData?`, `createdAt`.

### Server actions
Same pattern as T6.2:

| Action | Policy | Activity event |
|--------|--------|---------------|
| `createPayment({ dealId, number, date, fileUrl? })` | MEMBER+ | `paymentAdded { number }` |
| `updatePayment({ id, number, date, fileUrl? })` | MEMBER+ (own) / ADMIN+ | — |
| `voidPayment({ id })` | MEMBER+ | — |
| `deletePayment({ id })` | ADMIN+ | — |

### Alert logic
`hasPaymentAlert(deal: { stageKey: string; payments: Payment[] }): boolean`
```
deal.stageKey === "ganado"
AND payments.filter(p => !p.isVoid).length === 0
```

### UI — PaymentSection (inside DealDetail left panel, below QuoteSection)
Same structure as QuoteSection. Number format examples: "FAC-912", "REC-105".

### Print report integration
`hasQuoteAlert` and `hasPaymentAlert` are already read in the print report query (T5.11). With M6 data live, the "Sin Cotiz." / "Sin Pago" columns in the print report will now populate correctly — no code changes needed to the print component itself.

### Tests
- Integration: all CRUD paths + alert edge cases (add payment → alert off; void it → alert on; stage ≠ "ganado" → no alert)
- E2E: add payment → alert dot clears on card

---

## Cross-cutting concerns

### Activity log
Both `quoteAdded` and `paymentAdded` events use the existing `recordActivity(tx, { tenantId, entity: "Deal", entityId: dealId, type, payload, userId })` helper already built in M5.

### Search (Cmd-K)
Out of scope for M6. Quote/payment numbers searchable via global search is a M6+ enhancement.

### Error handling
All server actions return `{ ok: true; data } | { ok: false; error; code }`. Named codes: `storage_limit_exceeded`, `quote_not_found`, `payment_not_found`, `unauthorized`.

### RLS
`Quote`, `Payment`, and `Attachment` tables already have RLS policies from M2/M3. No new policies needed.

---

## Verification checklist

- [ ] `pnpm prisma migrate dev` applies new `storageMaxBytes` / `storageUsedBytes` fields cleanly
- [ ] Sign endpoint returns 403 when storage is full (test with `storageMaxBytes = 1`)
- [ ] Upload flow completes end-to-end: sign → PUT → confirm → Attachment row exists → counter incremented
- [ ] Delete flow: R2 object gone + counter decremented
- [ ] Quote CRUD: create / update / void / delete all persist correctly
- [ ] Alert "Falta Cotización" fires on contactado / cotizacion / negociacion / ganado with no active quote
- [ ] Alert "Falta Cotización" does NOT fire on prospecto or perdido
- [ ] Alert "Falta Pago" fires only on ganado with no active payment
- [ ] Pipeline card shows pulsing red dot when alert is active
- [ ] Print report "Sin Cotiz." / "Sin Pago" columns populated
- [ ] All integration tests green (`pnpm test:integration`)
- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` passes

---

## Deferred to M10

- Storage reconciliation: nightly Vercel Cron + manual "Recalcular" button in Settings that calls `ListObjectsV2` to correct `storageUsedBytes` drift
