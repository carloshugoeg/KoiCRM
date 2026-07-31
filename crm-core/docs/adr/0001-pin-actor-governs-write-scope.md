# ADR 0001: The action-PIN actor, not the session user, governs write scope

**Status:** Accepted
**Date:** 2026-07-30
**Context finding:** `docs/AUDIT_BACKLOG.md` FINDING-037 (LOW · Security)

## Context

When a tenant has `TenantSettings.pinEnabled`, sensitive deal writes require a 4-digit action
PIN that identifies the author (`lib/auth/action-pin.ts`, `resolveActionActor`). On a shared
terminal, a MEMBER might be signed in while an ADMIN enters their PIN to perform a write.

`resolveActionActor` returns the PIN owner's role as `actorRole`, and every deal write path
(`features/deals/actions.ts`, via `features/deals/guards.ts`) evaluates both **capability**
(`canEditDeal(actorRole)`, `canDeleteDeal(actorRole)`, …) and, since FINDING-035, **scope**
(`assertDealInScope(tenantId, actorRole, actorUserId, dealId)`, which resolves
`pipeline.viewAll` for `actorRole`/`actorUserId`) against the **PIN actor**, not the signed-in
browser session.

This was flagged during audit as a property nobody had explicitly signed off on: is it correct
that a write's scope — which deals a caller is even allowed to touch — follows whoever entered
their PIN, rather than whoever is signed into the browser?

## Decision

**Yes — this is correct and intentional, not a bug.** The PIN actor governs both capability and
scope for the same reason: **the PIN is the record of who is acting**, and the session is
merely the terminal that request happens to be typed on. Once a workspace enables PINs, the
identity that matters for every downstream authorization decision — "can this write happen at
all" (capability) and "which deals can this write touch" (scope) — is the identity that
authenticated the specific write, not the identity that happens to be logged into the browser.

Splitting the two — capability from the PIN actor, scope from the session user — would produce
an incoherent model: a MEMBER's browser session, on which an ADMIN enters their PIN, would let
the ADMIN's role approve actions ADMIN is entitled to (e.g. deleting a deal) while still
confining *which* deals it applies to based on the browser session's own restricted
`pipeline.viewAll`. That has no clean interpretation — it isn't "the MEMBER is bounded" (the
MEMBER isn't the one who authorized the write) and it isn't "the ADMIN is acting" (their scope
would be arbitrarily clipped by whoever happened to leave a browser session open). The PIN
exists precisely to make "who is acting" unambiguous; letting scope silently disagree with it
would undermine the reason it exists.

## Consequences

- On a shared terminal, a write's scope follows whoever last entered their PIN, for the
  duration that PIN's session-unlock window is open (`TenantSettings.pinUnlockWindowSeconds`).
  This is the same trust boundary the PIN model already places on write **capability** — this
  ADR does not introduce a new one, it just makes explicit that scope inherits it too.
- This is what makes the write-scope model introduced by FINDING-035 coherent: scope must
  follow the same actor authorship already follows, or the two would disagree about who is
  acting on any given write.
- No code change resulted from this ADR — `resolveActionActor` + `assertDealInScope` already
  implement this. See FINDING-010 (open, "Decision needed") for the related and *not yet
  settled* question of whether the PIN should carry authorization weight at all, versus being
  attribution-only with capability derived from the session role. That is a materially larger
  product decision than this one and is explicitly left open in the backlog.
