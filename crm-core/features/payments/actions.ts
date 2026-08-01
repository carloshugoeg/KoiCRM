"use server"

import { revalidatePath } from "next/cache"
import type { Role } from "@prisma/client"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { getUserRole, canEditDeal, canDeleteDeal } from "@/lib/auth/rbac"
import { resolveActionActor } from "@/lib/auth/action-pin"
import { recordActivity } from "@/features/activity/queries"
import { assertDealInScopeInTx } from "@/features/deals/guards"
import { CreatePaymentSchema, UpdatePaymentSchema } from "./schemas"

const PAYMENT_EDITOR_ROLES: readonly Role[] = ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER"]

export async function createPayment(tenantId: string, input: unknown) {
  const parsed = CreatePaymentSchema.safeParse(input)
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
  // foreign dealId doesn't cost a second interactive transaction and can't create a payment
  // under a deal they cannot see.
  let notFound = false
  const payment = await withTenant(tenantId, async (tx) => {
    if (!(await assertDealInScopeInTx(tx, tenantId, actor.actor.actorRole, actor.actor.actorUserId, data.dealId))) {
      notFound = true
      return null
    }
    const p = await tx.payment.create({
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
      type: "paymentAdded",
      payload: { number: data.number },
      userId: actor.actor.actorUserId,
    })
    return p
  })
  if (notFound) return { ok: false as const, error: "Deal not found", code: "not_found" }

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const, data: payment }
}

export async function updatePayment(tenantId: string, input: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized", code: "unauthorized" }

  const role = await getUserRole(session, tenantId)
  if (!role || !PAYMENT_EDITOR_ROLES.includes(role)) {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" }
  }

  const parsed = UpdatePaymentSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid input", code: "invalid_input" }
  const { id, ...updates } = parsed.data

  // updatePayment takes a bare payment id — the deal it belongs to is resolved here and the
  // scope check runs in the same transaction as the update, so an out-of-scope payment
  // (belonging to a deal the caller cannot see) is rejected exactly like a payment that doesn't
  // exist.
  let notFound = false
  const payment = await withTenant(tenantId, async (tx) => {
    const existing = await tx.payment.findUnique({ where: { id, tenantId }, select: { dealId: true } })
    if (!existing) { notFound = true; return null }
    if (!(await assertDealInScopeInTx(tx, tenantId, role, session.user.id, existing.dealId))) {
      notFound = true
      return null
    }
    return tx.payment.update({ where: { id, tenantId }, data: updates })
  })
  if (notFound) return { ok: false as const, error: "Payment not found", code: "not_found" }

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const, data: payment }
}

export async function voidPayment(tenantId: string, paymentId: string, pin?: string) {
  const paymentRef = await withTenant(tenantId, (tx) =>
    tx.payment.findUnique({ where: { id: paymentId, tenantId }, select: { dealId: true } }),
  )
  if (!paymentRef) return { ok: false as const, error: "Payment not found", code: "not_found" }

  const actor = await resolveActionActor({ tenantId, pin, dealId: paymentRef.dealId })
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
  const payment = await withTenant(tenantId, async (tx) => {
    if (
      !(await assertDealInScopeInTx(tx, tenantId, actor.actor.actorRole, actor.actor.actorUserId, paymentRef.dealId))
    ) {
      notFound = true
      return null
    }
    return tx.payment.update({ where: { id: paymentId, tenantId }, data: { isVoid: true } })
  })
  if (notFound) return { ok: false as const, error: "Payment not found", code: "not_found" }

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const, data: payment }
}

export async function deletePayment(tenantId: string, paymentId: string, pin?: string) {
  const paymentRef = await withTenant(tenantId, (tx) =>
    tx.payment.findUnique({ where: { id: paymentId, tenantId }, select: { dealId: true } }),
  )
  if (!paymentRef) return { ok: false as const, error: "Payment not found", code: "not_found" }

  const actor = await resolveActionActor({ tenantId, pin, dealId: paymentRef.dealId })
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
      !(await assertDealInScopeInTx(tx, tenantId, actor.actor.actorRole, actor.actor.actorUserId, paymentRef.dealId))
    ) {
      notFound = true
      return
    }
    await tx.payment.delete({ where: { id: paymentId, tenantId } })
  })
  if (notFound) return { ok: false as const, error: "Payment not found", code: "not_found" }

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const }
}
