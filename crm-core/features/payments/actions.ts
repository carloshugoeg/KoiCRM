"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole } from "@/lib/auth/rbac"
import { recordActivity } from "@/features/activity/queries"
import { CreatePaymentSchema, UpdatePaymentSchema } from "./schemas"

export async function createPayment(tenantId: string, input: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized", code: "unauthorized" }

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" }
  }

  const parsed = CreatePaymentSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid input", code: "invalid_input" }
  const data = parsed.data

  const payment = await withTenant(tenantId, async (tx) => {
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
      userId: session.user!.id,
    })
    return p
  })

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const, data: payment }
}

export async function updatePayment(tenantId: string, input: unknown) {
  const session = await auth()
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized", code: "unauthorized" }

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" }
  }

  const parsed = UpdatePaymentSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid input", code: "invalid_input" }
  const { id, ...updates } = parsed.data

  const payment = await withTenant(tenantId, (tx) =>
    tx.payment.update({ where: { id, tenantId }, data: updates }),
  )

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const, data: payment }
}

export async function voidPayment(tenantId: string, paymentId: string) {
  const session = await auth()
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized", code: "unauthorized" }

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" }
  }

  const payment = await withTenant(tenantId, (tx) =>
    tx.payment.update({ where: { id: paymentId, tenantId }, data: { isVoid: true } }),
  )

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const, data: payment }
}

export async function deletePayment(tenantId: string, paymentId: string) {
  const session = await auth()
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized", code: "unauthorized" }

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" }
  }

  await withTenant(tenantId, (tx) =>
    tx.payment.delete({ where: { id: paymentId, tenantId } }),
  )

  revalidatePath(`/app/[tenantSlug]/pipeline`, "page")
  return { ok: true as const }
}
