"use server"

import { revalidatePath } from "next/cache"
import type { Role } from "@prisma/client"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { getUserRole, canEditDeal, canDeleteDeal } from "@/lib/auth/rbac"
import { resolveActionActor } from "@/lib/auth/action-pin"
import { recordActivity } from "@/features/activity/queries"
import { assertDealInScopeInTx } from "@/features/deals/guards"
import { CreateQuoteSchema, UpdateQuoteSchema } from "./schemas"

const QUOTE_EDITOR_ROLES: readonly Role[] = ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER"]

export async function createQuote(tenantId: string, input: unknown) {
  const parsed = CreateQuoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid input", code: "invalid_input" }
  const data = parsed.data

  const actor = await resolveActionActor({ tenantId, pin: data.pin, dealId: data.dealId })
  if (!actor.ok) {
    return {
      ok: false as const,
      error: actor.error ?? "Se requiere PIN.",
      code: actor.requiresPin ? "pin_required" : "unauthorized",
      requiresPin: actor.requiresPin,
    }
  }
  if (!canEditDeal(actor.actor.actorRole)) {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" }
  }

  // The scope check runs in the same transaction as the create, so a restricted actor naming a
  // foreign dealId doesn't cost a second interactive transaction and can't create a quote under
  // a deal they cannot see.
  let notFound = false
  const quote = await withTenant(tenantId, async (tx) => {
    if (!(await assertDealInScopeInTx(tx, tenantId, actor.actor.actorRole, actor.actor.actorUserId, data.dealId))) {
      notFound = true
      return null
    }
    const q = await tx.quote.create({
      data: {
        tenantId,
        dealId: data.dealId,
        number: data.number,
        date: data.date,
        fileUrl: data.fileUrl ?? null,
      },
    })
    await recordActivity(tx, {
      tenantId,
      entity: "Deal",
      entityId: data.dealId,
      type: "quoteAdded",
      payload: { number: data.number },
      userId: actor.actor.actorUserId,
    })
    return q
  })
  if (notFound) return { ok: false as const, error: "Deal not found", code: "not_found" }

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const, data: quote }
}

export async function updateQuote(tenantId: string, input: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized", code: "unauthorized" }

  const role = await getUserRole(session, tenantId)
  if (!role || !QUOTE_EDITOR_ROLES.includes(role)) {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" }
  }

  const parsed = UpdateQuoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid input", code: "invalid_input" }
  const { id, ...updates } = parsed.data

  // updateQuote takes a bare quote id — the deal it belongs to is resolved here and the scope
  // check runs in the same transaction as the update, so an out-of-scope quote (belonging to a
  // deal the caller cannot see) is rejected exactly like a quote that doesn't exist.
  let notFound = false
  const quote = await withTenant(tenantId, async (tx) => {
    const existing = await tx.quote.findUnique({ where: { id, tenantId }, select: { dealId: true } })
    if (!existing) { notFound = true; return null }
    if (!(await assertDealInScopeInTx(tx, tenantId, role, session.user.id, existing.dealId))) {
      notFound = true
      return null
    }
    return tx.quote.update({ where: { id, tenantId }, data: updates })
  })
  if (notFound) return { ok: false as const, error: "Quote not found", code: "not_found" }

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const, data: quote }
}

export async function voidQuote(tenantId: string, quoteId: string, pin?: string) {
  const quoteRef = await withTenant(tenantId, (tx) =>
    tx.quote.findUnique({ where: { id: quoteId, tenantId }, select: { dealId: true } }),
  )
  if (!quoteRef) return { ok: false as const, error: "Quote not found", code: "not_found" }

  const actor = await resolveActionActor({ tenantId, pin, dealId: quoteRef.dealId })
  if (!actor.ok) {
    return {
      ok: false as const,
      error: actor.error ?? "Se requiere PIN.",
      code: actor.requiresPin ? "pin_required" : "unauthorized",
      requiresPin: actor.requiresPin,
    }
  }
  if (!canEditDeal(actor.actor.actorRole)) {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" }
  }

  let notFound = false
  const quote = await withTenant(tenantId, async (tx) => {
    if (
      !(await assertDealInScopeInTx(tx, tenantId, actor.actor.actorRole, actor.actor.actorUserId, quoteRef.dealId))
    ) {
      notFound = true
      return null
    }
    return tx.quote.update({ where: { id: quoteId, tenantId }, data: { isVoid: true } })
  })
  if (notFound) return { ok: false as const, error: "Quote not found", code: "not_found" }

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const, data: quote }
}

export async function deleteQuote(tenantId: string, quoteId: string, pin?: string) {
  const quoteRef = await withTenant(tenantId, (tx) =>
    tx.quote.findUnique({ where: { id: quoteId, tenantId }, select: { dealId: true } }),
  )
  if (!quoteRef) return { ok: false as const, error: "Quote not found", code: "not_found" }

  const actor = await resolveActionActor({ tenantId, pin, dealId: quoteRef.dealId })
  if (!actor.ok) {
    return {
      ok: false as const,
      error: actor.error ?? "Se requiere PIN.",
      code: actor.requiresPin ? "pin_required" : "unauthorized",
      requiresPin: actor.requiresPin,
    }
  }
  if (!canDeleteDeal(actor.actor.actorRole)) {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" }
  }

  let notFound = false
  await withTenant(tenantId, async (tx) => {
    if (
      !(await assertDealInScopeInTx(tx, tenantId, actor.actor.actorRole, actor.actor.actorUserId, quoteRef.dealId))
    ) {
      notFound = true
      return
    }
    await tx.quote.delete({ where: { id: quoteId, tenantId } })
  })
  if (notFound) return { ok: false as const, error: "Quote not found", code: "not_found" }

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const }
}
