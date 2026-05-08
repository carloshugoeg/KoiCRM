"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole } from "@/lib/auth/rbac"
import { prisma } from "@/lib/db/client"
import { generateDealId } from "@/lib/id/deal-id"
import { ownerInitials } from "@/lib/utils/avatar-color"
import { findOrCreateClient } from "@/features/clients/queries"
import { recordActivity } from "@/features/activity/queries"
import {
  createDealSchema,
  updateDealSchema,
  moveDealSchema,
  archiveDealSchema,
  updateDealFieldSchema,
} from "@/features/deals/schemas"
import { getDefaultPipeline } from "@/features/pipeline/queries"

export async function createDealAction(
  raw: unknown
): Promise<{ ok: boolean; error?: string; dealId?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = createDealSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, ...fields } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  // Get pipeline and first unlocked stage
  const pipeline = await getDefaultPipeline(tenantId)
  if (!pipeline) return { ok: false, error: "No hay un pipeline configurado." }
  const firstStage = pipeline.stages.find((s) => !s.locked)
  if (!firstStage) return { ok: false, error: "No hay etapas disponibles en el pipeline." }

  // Derive owner initials
  const owner = await prisma.user.findUnique({
    where: { id: fields.ownerId },
    select: { name: true },
  })

  let dealId: string | undefined
  try {
    await withTenant(tenantId, async (tx) => {
      const initials = ownerInitials(owner?.name)
      const id = await generateDealId(tx, tenantId, initials)

      // Detect or create client
      const client = await findOrCreateClient(tx, tenantId, {
        name: fields.name,
        company: fields.company,
        phone: fields.phone,
        whatsapp: fields.whatsapp,
        email: fields.email,
      })

      await tx.deal.create({
        data: {
          id,
          tenantId,
          pipelineId: pipeline.id,
          stageId: firstStage.id,
          clientId: client.id,
          ownerId: fields.ownerId,
          channelKey: fields.channelKey,
          statusKey: fields.statusKey,
          name: fields.name.trim(),
          company: fields.company?.trim() || null,
          phone: fields.phone?.trim() || null,
          whatsapp: fields.whatsapp?.trim() || null,
          email: fields.email?.trim() || null,
          value: fields.value,
          customData: fields.customData as Prisma.InputJsonValue | undefined,
          stageEnteredAt: new Date(),
        },
      })

      // Save equipment
      const equipmentRows: { dealId: string; equipmentKey: string; customLabel: string | null }[] = []
      for (const key of fields.equipment) {
        equipmentRows.push({ dealId: id, equipmentKey: key, customLabel: null })
      }
      if (fields.equipmentCustom?.trim()) {
        equipmentRows.push({ dealId: id, equipmentKey: "__custom__", customLabel: fields.equipmentCustom.trim() })
      }
      if (equipmentRows.length > 0) {
        await tx.dealEquipment.createMany({ data: equipmentRows })
      }

      await recordActivity(tx, {
        tenantId,
        entity: "Deal",
        entityId: id,
        type: "created",
        payload: { name: fields.name, ownerId: fields.ownerId },
        userId: session.user!.id,
      })

      dealId = id
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya existe una oportunidad con ese ID." }
    }
    throw e
  }

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  return { ok: true, dealId }
}

export async function updateDealAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = updateDealSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, dealId, ...fields } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  const existing = await prisma.deal.findUnique({ where: { id: dealId, tenantId } })
  if (!existing) return { ok: false, error: "Oportunidad no encontrada." }

  await withTenant(tenantId, async (tx) => {
    const updateData: Prisma.DealUpdateInput = {}
    if (fields.name !== undefined) updateData.name = fields.name.trim()
    if (fields.company !== undefined) updateData.company = fields.company?.trim() || null
    if (fields.phone !== undefined) updateData.phone = fields.phone?.trim() || null
    if (fields.whatsapp !== undefined) updateData.whatsapp = fields.whatsapp?.trim() || null
    if (fields.email !== undefined) updateData.email = fields.email?.trim() || null
    if (fields.value !== undefined) updateData.value = fields.value
    if (fields.statusKey !== undefined) updateData.statusKey = fields.statusKey
    if (fields.channelKey !== undefined) updateData.channelKey = fields.channelKey

    await tx.deal.update({ where: { id: dealId }, data: updateData })

    if (fields.equipment !== undefined || fields.equipmentCustom !== undefined) {
      await tx.dealEquipment.deleteMany({ where: { dealId } })
      const equipmentRows: { dealId: string; equipmentKey: string; customLabel: string | null }[] = []
      for (const key of fields.equipment ?? []) {
        equipmentRows.push({ dealId, equipmentKey: key, customLabel: null })
      }
      if (fields.equipmentCustom?.trim()) {
        equipmentRows.push({ dealId, equipmentKey: "__custom__", customLabel: fields.equipmentCustom.trim() })
      }
      if (equipmentRows.length > 0) {
        await tx.dealEquipment.createMany({ data: equipmentRows })
      }
    }

    if (fields.ownerId && fields.ownerId !== existing.ownerId) {
      await recordActivity(tx, { tenantId, entity: "Deal", entityId: dealId, type: "ownerChanged", payload: { from: existing.ownerId, to: fields.ownerId }, userId: session.user!.id })
    }
    if (fields.value !== undefined && Number(fields.value) !== Number(existing.value)) {
      await recordActivity(tx, { tenantId, entity: "Deal", entityId: dealId, type: "valueChanged", payload: { old: Number(existing.value), new: fields.value }, userId: session.user!.id })
    }
  })

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  return { ok: true }
}

export async function moveDealAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = moveDealSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, dealId, toStageId, force } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  const [deal, targetStage] = await Promise.all([
    prisma.deal.findUnique({ where: { id: dealId, tenantId }, select: { stageId: true } }),
    prisma.pipelineStage.findUnique({ where: { id: toStageId, tenantId } }),
  ])

  if (!deal) return { ok: false, error: "Oportunidad no encontrada." }
  if (!targetStage) return { ok: false, error: "Etapa no encontrada." }
  if (targetStage.locked && !force) {
    return { ok: false, error: `La etapa "${targetStage.label}" está bloqueada. Usa las acciones del panel de detalle.` }
  }

  const fromStageId = deal.stageId

  await withTenant(tenantId, async (tx) => {
    await tx.deal.update({
      where: { id: dealId },
      data: { stageId: toStageId, stageEnteredAt: new Date() },
    })
    await recordActivity(tx, {
      tenantId,
      entity: "Deal",
      entityId: dealId,
      type: "stageChanged",
      payload: { from: fromStageId, to: toStageId, toLabel: targetStage.label },
      userId: session.user!.id,
    })
  })

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  revalidatePath(`/app/${tenantSlug}/archive`, "page")
  return { ok: true }
}

export async function archiveDealAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = archiveDealSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, dealId } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  const deal = await prisma.deal.findUnique({ where: { id: dealId, tenantId } })
  if (!deal) return { ok: false, error: "Oportunidad no encontrada." }

  await withTenant(tenantId, async (tx) => {
    await tx.deal.update({ where: { id: dealId }, data: { isArchived: true } })
    await recordActivity(tx, {
      tenantId,
      entity: "Deal",
      entityId: dealId,
      type: "archived",
      payload: {},
      userId: session.user!.id,
    })
  })

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  revalidatePath(`/app/${tenantSlug}/archive`, "page")
  return { ok: true }
}

export async function updateDealFieldAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = updateDealFieldSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, dealId, field, value } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId, tenantId },
    select: { value: true, statusKey: true, phone: true, whatsapp: true, email: true, name: true, company: true },
  })
  if (!deal) return { ok: false, error: "Oportunidad no encontrada." }

  await withTenant(tenantId, async (tx) => {
    await tx.deal.update({ where: { id: dealId }, data: { [field]: value } })
    if (field === "value") {
      await recordActivity(tx, {
        tenantId,
        entity: "Deal",
        entityId: dealId,
        type: "valueChanged",
        payload: { old: Number(deal.value), new: value },
        userId: session.user!.id,
      })
    }
  })

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  return { ok: true }
}
