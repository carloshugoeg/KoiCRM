"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole, canEditDeal, canDeleteDeal } from "@/lib/auth/rbac"
import { resolveActionActor } from "@/lib/auth/action-pin"
import { recordActivity } from "@/features/activity/queries"
import { CreateQuoteSchema, UpdateQuoteSchema } from "./schemas"

export async function createQuote(tenantId: string, input: unknown) {
  const parsed = CreateQuoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid input", code: "invalid_input" }
  const data = parsed.data

  const actor = await resolveActionActor({ tenantId, pin: data.pin })
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

  const quote = await withTenant(tenantId, async (tx) => {
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

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const, data: quote }
}

export async function updateQuote(tenantId: string, input: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized", code: "unauthorized" }

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER"])
  } catch {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" }
  }

  const parsed = UpdateQuoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid input", code: "invalid_input" }
  const { id, ...updates } = parsed.data

  const quote = await withTenant(tenantId, (tx) =>
    tx.quote.update({ where: { id, tenantId }, data: updates }),
  )

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const, data: quote }
}

export async function voidQuote(tenantId: string, quoteId: string, pin?: string) {
  const actor = await resolveActionActor({ tenantId, pin })
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

  const quote = await withTenant(tenantId, (tx) =>
    tx.quote.update({ where: { id: quoteId, tenantId }, data: { isVoid: true } }),
  )

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const, data: quote }
}

export async function deleteQuote(tenantId: string, quoteId: string, pin?: string) {
  const actor = await resolveActionActor({ tenantId, pin })
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

  await withTenant(tenantId, (tx) =>
    tx.quote.delete({ where: { id: quoteId, tenantId } }),
  )

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const }
}
