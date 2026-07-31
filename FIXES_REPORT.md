# Documented-findings fix report

Branch: `fix/documented-findings`
Worktree: `/Users/carloshugo/Documents/Projects/KoiCRM-fixes/crm-core`

Working through `crm-core/docs/AUDIT_BACKLOG.md`, highest severity first, skipping anything
that needs a product decision the backlog doesn't already settle. Updated as each finding
lands, not written retroactively.

---

## FINDING-014 · HIGH · Logic — `deactivateMemberAction` is not atomic — RESOLVED

**What was wrong:** the deal-reassignment step ran inside one `withTenant` transaction, then
the membership status flip (`ACTIVE` → `INACTIVE`) ran as a second, independent
`prisma.membership.update` call with no compensating action. If the second call failed after
the first committed, an offboarded employee's deals were already handed to someone else, but
the employee's membership stayed `ACTIVE` and they could still sign in.

**TDD evidence:**

Wrote `tests/integration/offboarding-atomicity.test.ts` first. Reproducing "the second write
throws" needed a *real* Postgres failure, not a mocked one — spying on the top-level
`prisma.membership.update` doesn't intercept a call made through the `tx` client inside an
interactive transaction (verified empirically: `tx.membership.update === prisma.membership.update`
is `false`; a throwaway spy test showed 0 intercepted calls). Instead, a mock on
`recordActivities` — called by both the old and new code, after the deal reassignment and
before the membership write — deletes the target's membership row from a second, independent
Prisma connection. That delete commits immediately, so whichever code path tries to update that
row next hits a genuine "record not found" (P2025) from Postgres.

Red run (against the pre-fix code):
```
✓ happy path: reassigns deals and deactivates the membership together
× rolls back the deal reassignment when the membership write fails …
  AssertionError: expected 'cms8ej17b000inmwhff8853kb' to be 'cms8ej17b000fnmwhok1qrx62'
  (deal.ownerId was already the reassign-to user, despite the action rejecting)
```
The promise correctly rejected (matches the existing house style of catching only specific,
expected error codes and letting the rest propagate — see `setMemberPinAction`'s P2002-only
catch), but the deal had already been reassigned. That's the bug, reproduced for the real
reason described in the backlog entry.

**Fix:** moved `tx.membership.update(...)` inside the same `withTenant(tenantId, ...)` callback
that reassigns the deals, exactly as the backlog entry specified (`Membership` has no RLS
policy, so writing it through the tenant-scoped `tx` is safe — same pattern already used by
`updateMemberAction`'s combined `user` + `membership` transaction just above it in the same
file).

Green run (same test, post-fix):
```
✓ happy path: reassigns deals and deactivates the membership together
✓ rolls back the deal reassignment when the membership write fails …
```

**Transaction count on this path:** before, 1 interactive transaction (`withTenant`, deal
reassignment) + 1 standalone query (`prisma.membership.update`). After, 1 interactive
transaction total — a reduction, not a fan-out.

**Files:** `features/users/actions.ts`, `tests/integration/offboarding-atomicity.test.ts` (new).

**Verification:** `pnpm type-check && pnpm lint && pnpm test && pnpm test:integration` all
green (129/129 unit, 284/284 integration across 36 files, including the 2 new tests).

---

## FINDING-005 · HIGH · Security — storage quota bypass via client-declared size — RESOLVED

**What was wrong:** `confirmUpload` trusted the client-supplied `size` field for both the quota
gate (`storageUsedBytes + size > storageMaxBytes`) and the `storageUsedBytes` increment. A
client PUTs whatever bytes it wants to a presigned S3 URL and then separately calls
`confirmUpload` with an arbitrary JSON body — nothing ties `data.size` to what was actually
uploaded. Declaring a small size for a large object stores the object while barely charging the
tenant's quota, making the paid storage tier unenforceable.

**Design decision — the HEAD-failure fallback:** the backlog entry explicitly warned that a
`HeadObjectCommand` failure must not break uploads for live users, and that falling back to the
declared size on failure would just reintroduce the bypass. Chose:
1. Retry the HEAD call up to 3 times (100ms, 300ms backoff) — absorbs the overwhelmingly common
   failure mode (a transient network blip), since S3/R2 HEAD-after-PUT is strongly consistent.
2. If still unresolved: **do not** fall back to the declared size for accounting. The upload is
   still accepted (the object is already durably in S3 — refusing it would be the "broke
   uploads for live users" outcome the entry warned against) and the `Attachment` row is created
   using the declared size only as a display placeholder, but `storageUsedBytes` is **not**
   incremented. A `Sentry.captureMessage` (warning level, tagged with tenantId/attachmentId/key)
   records it for manual reconciliation.
3. The one exception: if the tenant's already-verified `storageUsedBytes` is at or over
   `storageMaxBytes`, the upload is still refused — accepting more unaccounted data for a
   tenant already over quota isn't "not breaking uploads," it's compounding the exact problem
   being fixed. Every other tenant is let through.
4. No automated reconciliation job — there's no job/cron infrastructure in this codebase
   (checked: no queue, no scheduled task runner), and building one wasn't in scope for this
   fix. The Sentry event is the reconciliation signal; a follow-up script that lists flagged
   attachments and re-HEADs them can close the loop later. Noted as a gap, not silently glossed
   over.
5. The HEAD call runs **before** `withTenant`, not inside it — it's a network call with
   retries/backoff, and holding a pooled interactive transaction open across that would be
   exactly the kind of fan-out `docs/ops` (commit `15889e3`) exists to prevent under
   `connection_limit=1`.
6. Bonus, same call site: also re-checks the verified size against `fileSizeMaxBytes` (the
   per-file cap), which was previously enforced only at presign time using the same
   client-declared value — closing a smaller instance of the identical trust problem for free.

**TDD evidence:** added a new `describe` block to `tests/integration/attachments.test.ts`
(existing 7 tests updated to mock the new `getObjectSize` S3 export, defaulting to "S3 agrees
with the client" so they're unaffected). Ran the 4 new tests against the pre-fix code first
(temporarily stashed the fix, confirmed with `git stash`/`git stash pop`):

Red run (pre-fix):
```
× accounts for the real S3 size even when the client declares a much smaller one
  expected 1n to be 5000000n            (declared 1 byte was trusted for a 5MB object)
× rejects as storage_limit_exceeded from the verified size, even when declared size would fit
  expected true to be false             (upload succeeded despite exceeding the real quota)
× does not credit storage … when S3 verification fails after retries
  expected 2048n to be 0n               (declared size WAS credited — no verification ever ran)
 Tests  3 failed | 8 passed (11)
```

Green run (post-fix, same tests):
```
✓ accounts for the real S3 size even when the client declares a much smaller one
✓ rejects as storage_limit_exceeded from the verified size, even when declared size would fit
✓ does not credit storage … when S3 verification fails after retries, but still lets the upload through
✓ still refuses uploads when verification fails and the tenant is already at/over its trusted quota
 Test Files  1 passed (1)   Tests  11 passed (11)
```

**Transaction count on this path:** unchanged — 1 interactive transaction (`withTenant`) per
`confirmUpload` call, same as before. The new S3 HEAD call (with its retries) happens outside
that transaction, so no fan-out was added.

**Files:** `lib/storage/s3.ts` (new `getObjectSize`), `features/attachments/actions.ts`,
`tests/integration/attachments.test.ts`.

**Deliberately not done:** FINDING-011 (avatar/branding uploads have no accounting at all) and
FINDING-017 (presign/confirm TOCTOU) both name this function as "fix alongside" — left for
their own entries; FINDING-011 needs a storage-usage reconciliation pass first per its own
entry, which is a separate, larger piece of work.

**Verification:** `pnpm type-check && pnpm lint && pnpm test && pnpm test:integration` all
green (129/129 unit, 288/288 integration across 36 files).

---

## FINDING-021 · MEDIUM · Performance — already resolved, no code change

While reading `app/app/[tenantSlug]/clients/page.tsx` and `features/clients/queries.ts` to work
this finding, found it was already fixed: commit `15889e3` (same day as the audit) collapsed
the six-transaction fan-out into one `withTenant` call (`loadClientsPageData`) with the
sub-queries issued via `Promise.all` on the shared `tx`. No bare `prisma.*` call remains in
either file. Confirmed with `git log` on both files and by reading the current implementation.
Updated `docs/AUDIT_BACKLOG.md` to mark it RESOLVED with this note; no source change needed.

---

## FINDING-022 · LOW · Performance — N+1 in resolveEquipmentPairs — RESOLVED

**What was wrong:** `resolveEquipmentPairs` (`features/deals/actions.ts`) called
`isActiveSubcategoryOfCategory` once per subcategoría in a nested loop, inside the
`withTenant` transaction that also creates the deal — one query per selected subcategoría.

**Fix:** added `activeSubcategoryParentsInTx` (`features/catalogs/queries.ts`) — a single
`findMany({ key: { in: [...] } })` returning a `Map<subcategoryKey, {categoryKey, active}>`.
Correctness relies on the existing `@@unique([tenantId, catalogKey, key])` constraint, so each
subcategoryKey maps to exactly one parent regardless of how many groups reference it.
`resolveEquipmentPairs` now does one query, then validates in memory. Removed
`isActiveSubcategoryOfCategory` — it had no other callers after the change, and leaving it
would be dead code.

**Tests:** no existing coverage exercised this validation logic at all (checked — no test calls
`createDealAction`, and the equipment-hierarchy tests operate on raw rows). Added
`tests/integration/catalogs.test.ts > activeSubcategoryParentsInTx`, pinning the exact rules
the old per-pair check enforced: inactive subcategoría omitted from the result, category
mismatch detectable, inactive parent detectable, and an empty input never issuing a query. All
pass against the new implementation (10/10 in that file).

**Verification:** `pnpm type-check && pnpm lint && pnpm test && pnpm test:integration` all
green (129/129 unit, 292/292 integration).

---
