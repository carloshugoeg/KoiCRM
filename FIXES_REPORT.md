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
