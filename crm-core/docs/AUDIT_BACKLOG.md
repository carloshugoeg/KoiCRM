# Audit Backlog — open findings

Source: full static audit of `crm-core/` performed 2026-07-26 (33 findings total).
Six findings were fixed immediately because they were safe to apply to a live system; the
27 below were deliberately **deferred** and are recorded here so they are not lost.

Each entry keeps its original `FINDING-0xx` id from the audit so cross-references stay stable.

Verification baseline at time of writing: `tsc --noEmit` clean, `next lint` clean,
`vitest run` 98/98 passing.

---

## Already fixed (do not re-open)

| ID | Severity | Summary | Where |
|----|----------|---------|-------|
| FINDING-001 | CRITICAL | Stored XSS via `bgImageUrl` breaking out of the `<style>` block | `lib/branding/css-vars.ts`, `features/branding/actions.ts` |
| FINDING-002 | CRITICAL | Cross-tenant read — 3 deal getters never checked membership | `features/deals/actions.ts` |
| FINDING-003 | CRITICAL | ADMIN could reset the OWNER's password / reassign their PIN | `features/users/actions.ts` |
| FINDING-009 | MEDIUM | Rate limits keyed on spoofable `x-forwarded-for` head | `lib/auth/client-ip.ts` (new) |
| FINDING-019 | HIGH | N+1 activity INSERTs could exceed the tx timeout on offboarding | `features/activity/queries.ts` |
| FINDING-020 | MEDIUM | Nested transaction → connection-pool exhaustion at `connection_limit=1` | `features/catalogs/queries.ts` |
| FINDING-027 | LOW | `canEditDealRow` dead ownership parameters — function deleted outright once write paths adopted the read scope (see FINDING-035 below) | `lib/auth/permissions.ts` (removed) |

---

## Resolved — product decisions

These three were recorded as open product decisions earlier in the permissions-and-scope port.
All three have since been decided and implemented; kept here (rather than folded into the
table above) so the reasoning behind each call stays on the record, not just the outcome.

### FINDING-034 · MEDIUM · Security — RESOLVED
**Follow-up alerts and the calendar use strict ownership, not the deal-visibility rule**
`features/follow-ups/queries.ts:62`; `features/calendar/queries.ts:19`

`pipeline.viewAll` resolves to `visibleToUserId`, which the rest of the app expands to
"owned **or** ceded via `DealViewer`" through `dealVisibilityWhere`. These two still filter on
`ownerId` alone, so a deal ceded to an advisor shows up in their funnel, archive, search,
reports and stats — and its follow-up disappears from their calendar and their alert banner.

**Decision:** cesión transfers the work — a ceded deal's follow-ups belong to whoever it was
ceded to, the same as every other read surface, not to its original owner. The calendar's
"personal agenda" framing loses to consistency: a deal that shows up on someone's funnel but
not their calendar was the actual bug, not a deliberate split.

**Implemented:** `getFollowUpAlertsInTx` and `getCalendarFollowUps` now filter through
`dealVisibilityWhere` instead of bare `ownerId`. Covered by
`tests/integration/pipeline-scope.test.ts` ("cesión — follow-ups and the calendar follow the
deal, not the owner").

### FINDING-035 · MEDIUM · Security — RESOLVED
**Write paths are role-gated while read paths are now scope-gated**
`features/deals/actions.ts` (update/move/field writers); `app/api/upload/deal/route.ts:80-88`

After the permission port, reading a deal honours `pipeline.viewAll`, but writing one still
only asked `canEditDeal(role)`: any in-tenant `dealId` was accepted. A restricted MEMBER who
obtained a foreign deal id could not read it and could still edit it.

**Decision:** writes adopt the same scope as reads. The PIN's authorship record is not a
substitute for an authorization check — it says who acted, not who was allowed to.

**Implemented:** across 23 write paths, funnelled through `assertDealInScope` /
`assertDealInScopeInTx` (`features/deals/guards.ts`), the same guard the read actions already
used. `canEditDealRow` — which had carried unused ownership parameters since "embudo abierto"
removed ownership restrictions (former FINDING-027, above) — was deleted rather than updated,
since the scope guard replaced what it was gesturing at. Covered by
`tests/integration/pipeline-scope.test.ts` ("deal write actions honour the caller's scope").

### FINDING-036 · LOW · Security — RESOLVED
**Stats panels other than `listado` aggregate every deal in the tenant**
`app/app/[tenantSlug]/stats/{resumen,embudo,canal,equipo,productos}/page.tsx`

`stats/listado` honours `pipeline.viewAll`; the other five aggregate the whole tenant for
anyone who can reach `/stats` (SUPERVISOR and above, enforced by `stats/layout.tsx:19`).
`stats.viewTotals` hides the money but not the counts.

**Decision:** intentional, not a gap. `/stats` is already a Supervisor+ management view, and
counts/totals are aggregate figures, not individual records — a tenant-wide deal count doesn't
disclose what any one colleague is working on the way a named list of opportunities would.
The separation between `stats.*` and `pipeline.*` in the design spec is deliberate: aggregate
panels stay tenant-wide; anything that lists individual deals must still scope by
`pipeline.viewAll`, because that is functionally the funnel by another name.

**Implemented:** `stats/listado` was already scoped. `stats/alerts` — a row-level panel
(follow-ups carry `deal.name`, `deal.company`, `deal.stage` and a free-text note) that had been
missed — is now scoped the same way, via `app/app/[tenantSlug]/stats/alerts/page-data.ts`.
Covered by `tests/integration/pipeline-scope.test.ts` ("stats/alerts page data honours
pipeline.viewAll scope").

---

## Deferred — needs a product decision

### FINDING-004 · HIGH · Security
**`force` flag is client-controlled and bypasses locked-stage rules**
`features/deals/actions.ts:268` + `features/deals/schemas.ts:94`

`force: z.boolean().default(false)` arrives in the request body and is the only gate on
`if (targetStage.locked && !force)`. Any MEMBER can forge `force: true` and move a deal into
a locked stage. `ganado` is incidentally protected by an independent payment-proof re-check;
`perdido` and all other locked stages are not.

**Why deferred, not fixed:** `force: true` is sent by the legitimate "Marcar como
ganado/perdido" buttons in the detail panel (`DealDetailModal.tsx:232` →
`handleMove(toStageId, force)`). Gating `force` on SUPERVISOR+ would break MEMBER workflows
that work today. **Decision needed:** which roles may close a deal? Options:
1. Restrict `force` to `canArchiveDeal` (SUPERVISOR+) — changes who can close deals.
2. Keep MEMBER access but require an action PIN for forced transitions.
3. Replace the boolean with explicit intent-named actions (`markWonAction` / `markLostAction`)
   that carry their own role checks — recommended, removes the client-controlled privilege flag.

### FINDING-010 · MEDIUM · Security
**The 4-digit PIN is an authorization credential, not just an audit tag**
`lib/auth/action-pin.ts:133-142`; `lib/auth/session-pin-lock.ts:50-53`

The PIN lookup returns `actorRole`, and deal actions gate capability on it
(`canDeleteDeal(actorRole)`), so a 4-digit secret is load-bearing for privilege. A MEMBER who
learns an ADMIN's PIN gains ADMIN deal powers including permanent delete. The 10-attempts /
5-minute throttle makes exhausting the 10,000-value space slow but not impossible.
Separately, `sessionLocked` ("modo PIN") lives in a user-deletable cookie — HMAC-signed so
unforgeable, but clearing it downgrades enforcement to "PIN only for other users' deals".

**Decision needed:** was PIN intended for attribution only? If so, capability should derive
from the *session* role and the PIN should only stamp authorship. Write this up as an ADR
either way.

### FINDING-012 · LOW · Security
**`GET /api/join/accept` mutates state without CSRF protection**
`app/api/join/accept/route.ts:29`

A `GET` handler calls `prisma.membership.create` with no CSRF token and no per-link use cap;
links live 90 days and are reusable without limit. The 32-byte token is unguessable, so this
is not an auth weakness — but a logged-in victim induced to load the URL is silently enrolled
into an attacker-controlled tenant.

**Why deferred:** converting to POST breaks every join link already distributed. Needs a
migration path (interstitial confirmation page that POSTs), plus a `maxUses` column decision.

### FINDING-037 · LOW · Security — RESOLVED (documented)
**Write scope is evaluated against the action-PIN actor, not the session user**
`lib/auth/action-pin.ts` (`resolveActionActor`); `features/deals/guards.ts`

When a tenant has PINs enabled, `resolveActionActor` determines whose role — and therefore
whose `pipeline.viewAll` / scope — governs a write, not whoever is signed into the browser. On
a shared terminal, a write's scope follows whoever last entered their PIN. This is the same
shape as the pre-existing `canEditDeal(actorRole)` check (the PIN actor's role has always
gated write capability), and it is what makes the write-scope model from FINDING-035 coherent —
scope has to follow the same actor authorship already follows, or the two would disagree about
who is acting. Not a bug: this surfaced in review as a property nobody had explicitly signed
off on, so it is recorded here as a decision rather than left to be rediscovered from the code.

**Decision needed:** none functionally — current behaviour is correct given how the PIN model
works. Write it up as an ADR (see FINDING-033's note on undocumented deliberate trade-offs) so
a future reader finds the reasoning here instead of re-deriving it.

**Implemented:** `docs/adr/0001-pin-actor-governs-write-scope.md`. No code change — the ADR
records why current behaviour is correct, so it stops looking like an oversight to the next
reader. Explicitly does not resolve FINDING-010 (open), which is the larger, not-yet-settled
question of whether the PIN should carry authorization weight at all.

---

## Deferred — needs infrastructure work or a migration

### FINDING-006 · HIGH · Security
**Production CSP still allows `'unsafe-inline'` for `script-src`**
`next.config.mjs:8`

Negates most XSS mitigation and was the reason FINDING-001 was exploitable rather than inert.
The dev/prod split for `'unsafe-eval'` shows the intent was already there.

**Why deferred:** removing `'unsafe-inline'` without a nonce strategy breaks Next.js
framework inline scripts and would take the app down. Requires nonce propagation through
`middleware.ts` + `next.config.mjs`. Do this in a preview deployment first.

### FINDING-007 · MEDIUM · Security
**RLS coverage gaps, and new tables default to unprotected**
`prisma/migrations/20260502213914_rls/migration.sql` (final block)

Five models carry `tenantId` but have no policy: `Membership`, `Invitation`, `JoinLink`,
`TenantBranding`, `TenantSettings`. `Membership` is arguably deliberate (cross-tenant reads
precede tenant context); `TenantSettings` — every storage tier, PIN setting and limit — is
protected only by application-level `where` clauses.

Worse structurally:
```sql
ALTER DEFAULT PRIVILEGES FOR ROLE admin_user IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
```
Future tables get DML automatically but **not** RLS, so the default posture for any new
tenant-scoped table is cross-tenant readable until someone remembers the policy.

**Suggested work:** (a) add policies for `TenantSettings`, `TenantBranding`, `JoinLink`,
`Invitation`; (b) add an integration test asserting every `tenantId`-bearing table has
`relrowsecurity = true`, so the gap can never reappear silently; (c) ADR for the `Membership`
exemption. Note prod migrations are applied **manually** — see `docs/ops/`.

### FINDING-008 · MEDIUM · Security
**`SET ROLE app_user` is unreliable for non-transactional queries**
`lib/db/ensure-app-role.ts:39-46`

Two defects:
- (a) On the transaction pooler — the documented production config
  (`:6543?pgbouncer=true&connection_limit=1`, `docs/ops/vercel-github.md:82`) — `SET ROLE
  app_user` and the following `query(args)` are two separate statements outside any
  transaction, so pgbouncer may assign them different backends and the query can run as the
  connection owner.
- (b) `if (!client) return;` silently no-ops when `registerBasePrismaClient` has not run yet —
  fails open rather than closed.

`withTenant` / `withPrismaTransaction` are **not** affected (they use `SET LOCAL ROLE` +
`set_config` inside one pinned transaction and are correct).

**Interaction with FINDING-007:** every bare `prisma.*` query probably runs with owner
privileges in production, but no isolation is lost *today* only because those tables lack RLS.
**The two findings mask each other — closing either one alone leaves the gap.** Sequence them
together.

### FINDING-023 · LOW · Performance
**`DealEquipment.subcategoryKey` is unindexed**
`prisma/schema.prisma:324-335`

`@@id([dealId, subcategoryKey])` covers `dealId`-leading lookups and `@@index([categoryKey])`
covers category filters, but `getCatalogItemUsageCount` queries
`where: { deal: { tenantId }, subcategoryKey: key }` (`features/catalogs/queries.ts:129`) with
no usable index → sequential scan. Confined to an admin-only settings screen.

**Why deferred:** needs a migration, and prod migrations are manual. Bundle it with the
FINDING-007 policy migration to avoid two manual applications.

---

## Deferred — safe but needs care / larger diff

### FINDING-005 · HIGH · Security — RESOLVED
**Storage quota bypass via client-declared size**
`features/attachments/actions.ts:68-88`

`confirmUpload` validates the key prefix but trusts client-supplied `data.size` for both the
quota check and `storageUsedBytes: { increment: BigInt(data.size) }`. Declaring `size: 0` for a
large object stores it while incrementing accounting by zero, making the paid storage tier
unenforceable. Direct revenue impact.

**Fix:** read the authoritative size from S3 (`HeadObjectCommand`) instead of trusting input.
**Why deferred:** adds a network call to the upload path; a HEAD failure must not break
uploads for live users, so it needs a considered failure mode (retry / reconcile job) rather
than a naive fallback to the declared size, which would preserve the bypass.

**Implemented:** `lib/storage/s3.ts` gained `getObjectSize` (`HeadObjectCommand`). It's called
before the `withTenant` transaction (a network call with retries has no business holding a
pooled connection open under `connection_limit=1`), retried 3x with a short backoff to absorb
transient failures, and its result — not `data.size` — now drives both the `fileSizeMaxBytes`
and `storageMaxBytes` checks and the increment. On a HEAD failure that survives retries: the
upload is still accepted (the object is already durably in S3; refusing it would be the "broke
uploads for live users" outcome this was deferred to avoid) but `storageUsedBytes` is **not**
incremented from the unverified declared size, and a `Sentry.captureMessage` records it for
manual reconciliation — except when the tenant's already-verified usage is at or over quota,
in which case the upload is still refused rather than let more unaccounted data in. There is no
automated reconciliation job (no queue/cron infrastructure exists in this codebase); the Sentry
event is the signal for a follow-up manual or scripted pass. Covered by
`tests/integration/attachments.test.ts` ("confirmUpload — storage accounting uses the verified
S3 size"), including the retry-then-fallback and still-refuses-when-already-over-quota cases.

### FINDING-011 · MEDIUM · Security
**Avatar and branding uploads sit outside every guardrail**
`app/api/upload/avatar/route.ts`, `app/api/upload/branding/route.ts`

Compared with the deal-upload path these have: no `storageUsedBytes` accounting, no rate limit
(`upload/sign` enforces 60/min), hardcoded size caps (`AVATAR_MAX_BYTES = 2MB`,
`BRANDING_MAX_BYTES = 5MB`) instead of `TenantSettings.fileSizeMaxBytes`, and no deletion of
the object being replaced (every re-upload orphans the previous one). Avatar returns the
proxied `buildMediaUrl(key)` while branding returns the raw bucket `publicUrl`, and
`{tenantId}/branding/…` is not matched by `isTenantMediaObjectKey`, so branding assets bypass
the authenticated media proxy.

Note the hardcoded caps also violate the project rule that all limits flow through
`TenantSettings`.

**Why deferred:** touching quota accounting on live upload paths needs a storage-usage
reconciliation pass first, otherwise existing untracked objects make `storageUsedBytes` wrong
the moment enforcement turns on.

### FINDING-013 · LOW · Security
**Attachment `url` / `mimeType` are client-controlled, stored, and rendered**
`features/attachments/actions.ts:74-83`; `lib/storage/media-url.ts:58`

`resolveStoredMediaUrl` returns the raw stored string when it matches no known key pattern, so
an arbitrary attacker-chosen URL is rendered in the attachment UI. Exploitability is limited by
the global `nosniff` header and `X-Frame-Options: DENY`, but it defeats the same-origin
media-proxy design. Fix alongside FINDING-005 (same function).

**Not done in the FINDING-005 pass:** that fix was scoped to `size` verification only —
`data.url` and `data.mimeType` are still trusted as-is from the client in `confirmUpload`. This
is a distinct validation gap in the same function and still needs its own fix (validate/reject
an unrecognized `url` shape rather than storing and rendering it).

### FINDING-014 · HIGH · Logic — RESOLVED
**`deactivateMemberAction` is not atomic**
`features/users/actions.ts` (deal reassignment inside `withTenant`, membership status change
after it)

Two independent transactions with no compensating action. If the second fails, deals are
reassigned but the offboarded employee remains `ACTIVE` and can still sign in — a
security-relevant outcome from a reliability defect.

**Partially addressed:** the N+1 inside the transaction was fixed (FINDING-019), which removes
the most likely cause of the second step never being reached. The atomicity gap itself remains.
**Fix:** move the `membership.update` inside the same `withTenant` transaction (`Membership`
has no RLS and `app_user` holds DML, so this works) — deferred only because offboarding is a
critical low-traffic path that deserves an integration test written first.

**Implemented:** wrote `tests/integration/offboarding-atomicity.test.ts` first, reproducing a
*real* mid-flight Postgres failure (spying on `prisma.membership.update` doesn't work — Prisma
builds a fresh delegate per interactive transaction, so it can't intercept a call made through
`tx`; a hook in `recordActivities` instead deletes the target's membership row from an
independent connection between the two writes). The red run showed the promise rejecting while
the deal had already been reassigned — the exact bug. Fix was exactly as specified:
`tx.membership.update(...)` now runs inside the same `withTenant` callback as the deal
reassignment, the same pattern `updateMemberAction` already used for `user` + `membership`.
Transaction count on this path went from 1 interactive transaction + 1 standalone query to 1
interactive transaction — a reduction. See `FIXES_REPORT.md` for the full red/green output.

### FINDING-015 · MEDIUM · Logic
**Early `return` inside a `withTenant` callback commits instead of aborting**
`features/deals/actions.ts` — 8 occurrences

Error signalling uses mutable outer flags (`let notFound = false`, `let createError`,
`let validationError`) with an early `return` from the callback. An early `return` **commits**
the transaction; only a thrown error rolls back. Today each path happens to return before
mutating, so there is no live bug — but any future branch that mutates first will silently
commit partial work, and each added branch is one forgotten post-transaction flag check away
from reporting success on failure.

**Fix:** adopt the tagged-throw pattern already used in `confirmUpload`
(`features/attachments/actions.ts:69`). Mechanical but touches all 7 deal write actions —
worth doing as its own reviewed change.

### FINDING-016 · MEDIUM · Logic
**`rateLimit` fails open**
`lib/auth/rate-limit.ts:25-28`

Catches all exceptions and returns `true`. Documented and defensible in isolation, but it is
the only brute-force control on the credentials login path, so a transient DB fault removes
login throttling entirely. Consider fail-closed for the signin key specifically, or an
in-process fallback counter.

### FINDING-017 · LOW · Logic
**TOCTOU on the storage quota between presign and confirm**
`app/api/upload/sign/route.ts:61` vs `features/attachments/actions.ts:68`

Concurrent presign requests all observe the pre-increment total. `confirmUpload` re-checks
inside its transaction, which bounds the overshoot. Residual; fix with FINDING-005.

**Not resolved by the FINDING-005 pass:** that fix made the confirm-time re-check trustworthy
(it now checks the S3-verified size instead of the declared one), which is a real improvement
to what this residual overshoot is bounded by — but it doesn't touch the presign-side race
itself. The window between concurrent presigns observing the same pre-increment total is
unchanged. Still open.

### FINDING-018 · LOW · Logic
**`signupAction` returns success for an existing email**
`features/users/actions.ts:39-40` (line numbers shifted after fixes)

Correct anti-enumeration behaviour, but indistinguishable from real registration: a user who
re-registers an existing address sees success, then cannot sign in with the password they chose.
Consider a generic "check your account or contact your administrator" confirmation screen.

### FINDING-021 · MEDIUM · Performance — RESOLVED (already fixed, pre-dates this pass)
**Six concurrent `withTenant` transactions per clients-page render**
`app/app/[tenantSlug]/clients/page.tsx:36-45`

Six independent transactions in one `Promise.all`, each requesting its own pooled connection
against `connection_limit=1`, so acquisition serializes and `P2024` risk rises under
concurrency. The same block also mixes a bare `prisma.tenantSettings` call in with the
RLS-scoped helpers.

**Fix:** consolidate into a single loader, exactly as `loadPipelineKanbanData` already does for
the pipeline page. The stats pages need the same treatment.

**Status found while working this backlog:** commit `15889e3` ("fix(perf): collapse per-page
transaction fan-out causing P2028 outages", same day as the audit) already did exactly this —
`loadClientsPageData` in `features/clients/queries.ts` runs one `withTenant` transaction with
the chrome/list/detail queries issued inside it via `Promise.all` on the shared `tx`, and there
is no bare `prisma.*` call left in that file or the page. The audit's line numbers describe a
state the code was already past by the time this entry was written. No code change made here —
verified by reading the current implementation and `git log` on both files. Leaving the stats
pages' equivalent, if any remains, to whoever picks up the LOW items — this entry only covers
the clients page named in its own title.

### FINDING-022 · LOW · Performance — RESOLVED
**N+1 in `resolveEquipmentPairs`**
`features/deals/actions.ts:52-58`

One `isActiveSubcategoryOfCategory` query per subcategory in a nested loop inside the
transaction. Collapse to a single `findMany({ where: { key: { in: [...] } } })` plus in-memory
validation of the parent relationship.

**Implemented:** added `activeSubcategoryParentsInTx` to `features/catalogs/queries.ts` — one
`findMany` with `key: { in: [...] }` returning a `Map<subcategoryKey, {categoryKey, active}>`,
relying on the existing `@@unique([tenantId, catalogKey, key])` constraint so each
subcategoryKey resolves to exactly one parent. `resolveEquipmentPairs` now calls it once and
validates the same rule (active, correct parent categoría, parent active) in memory. The
single-pair `isActiveSubcategoryOfCategory` had no other callers, so it was removed rather than
left dead. Covered by new tests in `tests/integration/catalogs.test.ts`
(`activeSubcategoryParentsInTx`), pinning the exact validity rules (inactive subcategoría
omitted, category mismatch detected, inactive parent detected) so the collapse is behaviour-
preserving.

---

## Deferred — architecture and maintainability

### FINDING-024 · MEDIUM · Architecture
**Circular dependency in the DB layer, broken by mutable runtime registries**
`lib/db/rls.ts:1-6` ↔ `lib/db/ensure-app-role.ts:2`

`rls.ts` imports `ensureAppRole` / `registerRoleEstablishedCheck` from `ensure-app-role.ts`,
which imports `PrismaTx` back from `rls.ts`. The cycle is broken at runtime by two module-level
registries (`registerRoleEstablishedCheck`, `registerBasePrismaClient`) rather than by
inverting the dependency, so correctness depends on **import-evaluation order** and both
registries degrade silently when unset (see FINDING-008b).

**Fix:** extract `PrismaTx` and the role-context contract into a leaf module with no back-edge,
and add a runtime assertion that registration occurred.

### FINDING-025 · MEDIUM · Architecture · + FINDING-028 · MEDIUM · Maintainability
**Two sources of truth for authorization policy (28 duplicated checks)**
`lib/auth/permissions.ts:14-15` vs 28 call sites across 13 files

`canManageMembers` / `canManageSettings` are used **only for UI gating** in the 8 settings
pages. Every server-side enforcement inlines `["OWNER", "ADMIN"].includes(caller.role)` instead
— 28 occurrences across 13 files (`app/api/upload/{branding,avatar,avatar/sign}/route.ts`,
`features/{clients,pipeline,branding,tenants,users,catalogs,custom-fields}/…`). Two modules did
extract the abstraction (`features/payments/policies.ts`, `features/quotes/policies.ts`); the
rest did not.

`canManageMembers = atLeast(r, "ADMIN")` is semantically identical given `OWNER: 5, ADMIN: 4`,
so consolidation is behaviour-preserving.

**This is the root cause of FINDING-003** — the inline checks omitted the target-side guard a
shared policy function would have centralised. Highest-leverage refactor in this backlog:
collapse all 28 to `canManageMembers(role)` and add `assertCanManageTarget(caller, target)`.

### FINDING-026 · MEDIUM · Architecture
**`phoneFormat` / `whatsappCountryCode` are dead settings — white-label is blocked**
`features/deals/schemas.ts:3-4` (6 usages)

Guatemala-specific validation is hardcoded into the domain layer:
```ts
const PHONE_RE = /^\d{4}-\d{4}$/
const WA_RE = /^\+502 \d{4}-\d{4}$/
```
Meanwhile the correct abstraction exists and is wired end-to-end but **never read**:
`TenantSettings.phoneFormat` / `.whatsappCountryCode` are persisted, validated in
`features/tenants/settings.ts:15-16`, and editable in the settings UI
(`features/tenants/components/general-settings.tsx:142-147`). Grep confirms zero validation
consumers.

Two defects in one: functionally a settings field silently does nothing (a user edits the phone
format and observes no effect); architecturally **no non-Guatemalan tenant can create a deal at
all**, which blocks the stated white-label V1 goal and contradicts `AGENTS.md`.

**Fix:** derive the validators from tenant settings (format string → regex) and thread settings
into the deal schemas, or drop the settings fields if GT-only is the accepted V1 scope — but
pick one, don't leave a no-op control in the UI.

### FINDING-029 · MEDIUM · Maintainability — PARTIALLY RESOLVED
**Test coverage is inverted relative to risk**
`tests/unit/` (14 files), `features/*/__tests__/` (3 dirs)

Tests exercise pure helpers — schemas, PIN tokens, media-URL regexes, RBAC rank arithmetic —
while there was **no test asserting authorization behaviour** for `features/users/actions.ts`
or the deal sub-resource getters. That is precisely why the full suite passed while
FINDING-002 and FINDING-003 were live.

**Partially addressed:** `bgImageUrl` injection coverage was added with the FINDING-001 fix
(the previous `buildCssVars` suite tested colours only, which is how the XSS slipped through).

**Still needed:** a table-driven authorization matrix — each privileged action × each caller
role × self / other / OWNER-target / non-member — over `features/users/actions.ts`,
`features/deals/actions.ts` getters, and the upload routes. This is the single highest-value
test investment in the codebase.

**Implemented (partial):** added `tests/integration/user-actions-authorization.test.ts` — the
matrix for every privileged action in `features/users/actions.ts` (`removeMemberAction`,
`changeMemberRoleAction`, `updateMemberAction`, `adminResetPasswordAction`,
`deactivateMemberAction`, `reactivateMemberAction`, `setMemberPinAction`,
`clearMemberPinAction`), 36 cases across caller role × target (self / other MEMBER / other
ADMIN / OWNER / non-member). This is exactly what the finding predicted: **writing it found two
more instances of the FINDING-003 bug class**, immediately, before the tests were even passing
— see FINDING-039 (new) below. The deal sub-resource getters and the upload routes are **not**
covered yet; left for a follow-up pass, this one already paid for itself.

### FINDING-039 · HIGH · Security (new — found writing the FINDING-029 matrix)
**Two more missing target-side ADMIN guards, same bug class as FINDING-003**
`features/users/actions.ts` — `changeMemberRoleAction`, `updateMemberAction`

While writing the FINDING-029 authorization matrix, two of `updateMemberAction`'s and
`changeMemberRoleAction`'s tests failed **before any test code was wrong** — actual gaps:

1. `updateMemberAction`'s role-change branch checked `isSelf`, `target.role === "OWNER"`, and
   `canManage` (OWNER or ADMIN), but never `target.role === "ADMIN" && caller.role !== "OWNER"`
   — the guard every sibling in this file has. **This one is live**: `EditMemberModal.tsx` calls
   `updateMemberAction` with a `role` payload whenever `canManageRole` is true (caller is
   OWNER/ADMIN) and the target isn't OWNER — nothing stopped one ADMIN from reassigning
   (including demoting) another ADMIN's role through Settings → Team, in production, today.
2. `changeMemberRoleAction` had the identical gap. This function currently has **no caller
   anywhere in the app** (`updateMemberAction`'s `role` field is the live role-change path), so
   it carried no live exposure — but it is an exported `"use server"` action, which means it is
   reachable the moment anything imports it, with no guard preventing the FINDING-003 pattern.

**Fix:** added `if (target.role === "ADMIN" && caller.role !== "OWNER") return { ok: false,
error: "Solo el propietario puede cambiar el rol de un administrador." }` to both, matching the
message family already used by `removeMemberAction` / `adminResetPasswordAction` /
`setMemberPinAction` / `clearMemberPinAction` / `deactivateMemberAction`. Covered by the new
matrix in `tests/integration/user-actions-authorization.test.ts`; before the fix, the matrix
failed with the target's role having actually changed in the database, not a mocked failure.

This is the argument for FINDING-025/028 (collapsing the 28 duplicated inline role checks into
one shared policy function) made concrete: two of the eight actions in this one file, all
following the identical hand-written pattern, independently drifted from it.

### FINDING-030 · LOW · Maintainability
**24 sites swallow errors into empty or falsy returns**
Representative: `features/attachments/actions.ts:24-29`

`getDealAttachmentsAction` returns `[]` on authorization failure, making "access denied"
indistinguishable from "no attachments" for both the caller and Sentry — suppressing exactly
the signal needed to detect exploitation of access-control bugs. Log denials to Sentry even
when returning a benign shape to the client.

### FINDING-031 · LOW · Maintainability
**Semicolon style is split; `.prettierrc` disagrees with the code**
Repository-wide; e.g. `lib/db/client.ts` (semicolons) vs `lib/db/rls.ts` (none)

Split roughly along `app/api/**` vs `features/**`, while `.prettierrc` declares `semi: true`.
`pnpm format` would rewrite most of the repository, so `lint:check` cannot be enforced in CI
today.

**Fix:** decide the house style, run the formatter once in a dedicated commit that touches
nothing else, then enforce it. Do **not** mix this with a behavioural change — it would bury
the real diff.

### FINDING-032 · LOW · Maintainability — RESOLVED
**Dead field: `createDealSchema.clientId`**
`features/deals/schemas.ts:48`

Accepted and validated but never read by `createDealAction`, which derives the client through
`findOrCreateClient` from name/phone. A caller supplying `clientId` gets no error and no
effect, implying an association capability that does not exist.

**Implemented:** removed the field from `createDealSchema`. Confirmed no in-tree caller ever
sent it — `ClientFormModal.tsx` (the only caller of `createDealAction`) always creates the deal
from name/phone — and `CreateDealInput` has no other consumers, so this is a pure deletion, not
a behaviour change. Dropped rather than wired up: there is no existing UI path for "attach this
new deal to an existing client by id," and inventing one wasn't the ask here — if that
capability is wanted later, it should come with its own UI and validation, not a schema field
nobody drives.

### FINDING-033 · LOW · Maintainability
**Empty scaffolding implies subsystems that do not exist**
`lib/logging/`, `lib/email/` (`.gitkeep` only); `docs/adr/` (empty)

`lib/logging/` suggests a logging module while the codebase actually depends on Sentry.
`docs/adr/` is empty despite `AGENTS.md` mandating ADRs for significant decisions — so the
deliberate trade-offs in this backlog (FINDING-010 PIN-as-authorization, FINDING-007
`Membership` RLS exemption, FINDING-016 fail-open rate limiting) are undocumented and
indistinguishable from oversights.

---

## Suggested sequencing

1. **FINDING-025 / 028** — collapse the 28 duplicated role checks. Root cause of FINDING-003;
   makes every future authorization change one edit instead of 29.
2. **FINDING-029** — the authorization test matrix. Do this *before* the refactor above so it
   pins current behaviour, then keep it green through the refactor.
3. **FINDING-004** — decide the deal-closing role model and remove the client-controlled
   `force` flag.
4. **FINDING-005 + 011 + 013 + 017** — one coherent storage-integrity pass (reconcile usage,
   then enforce).
5. **FINDING-007 + 008 + 023** — one coherent RLS / least-privilege pass, one manual prod
   migration. Write the ADRs here.
6. **FINDING-006** — CSP nonces, validated in a preview deployment.
7. **FINDING-014 + 015 + 021 + 022 + 024** — reliability and performance cleanup.
8. **FINDING-026** — tenant-driven phone validation (or explicitly scope V1 to GT).
9. **FINDING-031** — formatting, in an isolated commit.
10. Remaining LOW items (010 write-up, 012, 016, 018, 030, 032, 033, 037 write-up) as capacity
    allows.

### FINDING-038 · MEDIUM · UX
**Dark mode is unbuilt below the shell, and was being served automatically**
`components/providers.tsx`; `features/pipeline/components/{KanbanColumn,DealCard}.tsx`; `app/app/[tenantSlug]/layout.tsx`

Dark mode shipped as `defaultTheme="system"` with `enableSystem`, so every user whose OS was
set to dark received it without ever asking. Only the shell was ever themed: header, page
background, follow-up banners, the KPI and filter bars and the mobile stage rail (the last
three fixed on this branch). The funnel itself was never done — `KanbanColumn.tsx:99` and
`DealCard.tsx:134` set their surface with `style={{ background: "#ffffff" }}`, and an inline
style cannot carry a `dark:` variant at all, so those need converting to classes or CSS
variables before they can follow a theme. `layout.tsx:86` and `PipelineClient.tsx:203` use
`bg-[#f8faff]`. Beyond the funnel: ~10 hardcoded light backgrounds across 6 files and ~35
dark `text-slate-*` colours with no dark variant, spread over clients, calendar, stats and
settings. Measured in the browser, not estimated: white cards on a black page, on the
product's main screen.

Mitigated on branch `feat/permissions-and-scope` by pinning `forcedTheme="light"` and hiding
the Apariencia mode switch and the "Fondo oscuro" picker. `forcedTheme` rather than
`defaultTheme` because it also overrides a `"dark"` already persisted in localStorage by
someone who used the old switch. `bgColorDark` is still held in state and still saved, so no
tenant loses a colour it had chosen.

**Decision needed:** whether dark mode is a product commitment. If yes, the work is converting
the inline-hex surfaces to theme-aware values and then a screen-by-screen visual pass — it
needs eyes on every screen, not a find-and-replace. If no, delete the theme plumbing, the
`bgColorDark` branding field and the `.dark` block in `lib/branding/css-vars.ts` rather than
leaving half a feature in the tree. Until one of those happens the pin stays.
