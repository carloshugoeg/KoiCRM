"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import {
  requireRole,
  getUserRole,
  canCreateDeal,
  canEditDeal,
  canEditDealRow,
  canSeeAllDeals,
  canArchiveDeal,
  canDeleteDeal,
} from "@/lib/auth/rbac"
import { generateDealId } from "@/lib/id/deal-id"
import { ownerInitials } from "@/lib/utils/avatar-color"
import { findOrCreateClient } from "@/features/clients/queries"
import { recordActivity, getDealActivity } from "@/features/activity/queries"
import { getDealFollowUps } from "@/features/follow-ups/queries"
import { getQuotesForDeal } from "@/features/quotes/queries"
import { getPaymentsForDeal } from "@/features/payments/queries"
import {
  createDealSchema,
  updateDealSchema,
  moveDealSchema,
  archiveDealSchema,
  updateDealFieldSchema,
  transferDealSchema,
  deleteDealSchema,
} from "@/features/deals/schemas"
import { getDefaultPipeline } from "@/features/pipeline/queries"
import { isActiveCatalogItemKey } from "@/features/catalogs/queries"
import { z } from "zod"
import { getDeal } from "@/features/deals/queries"

export async function createDealAction(
  raw: unknown
): Promise<{ ok: boolean; error?: string; dealId?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = createDealSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, ...fields } = parsed.data

  const role = await getUserRole(session, tenantId)
  if (!role || !canCreateDeal(role)) return { ok: false, error: "Acceso denegado." }

  // Asesores can only create deals they own; supervisors/superadmins choose the owner.
  const ownerId = canSeeAllDeals(role) ? fields.ownerId : session.user.id

  let dealId: string | undefined
  let createError: string | undefined
  try {
    await withTenant(tenantId, async (tx) => {
      // Fetch pipeline with RLS (BUG-005 fix)
      const pipeline = await getDefaultPipeline(tx, tenantId)
      if (!pipeline) { createError = "No hay un pipeline configurado."; return }
      const firstStage = pipeline.stages.find((s) => !s.locked)
      if (!firstStage) { createError = "No hay etapas disponibles en el pipeline."; return }

      // Validate ownerId is a member of this tenant (BUG-003 fix)
      const ownerMembership = await tx.membership.findUnique({
        where: { userId_tenantId: { userId: ownerId, tenantId } },
      })
      if (!ownerMembership) { createError = "El asesor seleccionado no pertenece al equipo."; return }

      const channelValid = await isActiveCatalogItemKey(tenantId, "salesChannel", fields.channelKey)
      if (!channelValid) {
        createError = "El origen seleccionado no es válido o está inactivo."
        return
      }

      // Get owner name for ID generation
      const owner = await tx.user.findUnique({ where: { id: ownerId }, select: { name: true } })
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
          ownerId,
          createdById: session.user.id,
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
        payload: { name: fields.name, ownerId },
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

  if (createError) return { ok: false, error: createError }

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  return { ok: true, dealId }
}

export async function updateDealAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = updateDealSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, dealId, ...fields } = parsed.data

  const role = await getUserRole(session, tenantId)
  if (!role || !canEditDeal(role)) return { ok: false, error: "Acceso denegado." }

  let notFound = false
  let permissionError = false
  let validationError: string | undefined
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.deal.findUnique({ where: { id: dealId, tenantId } })
    if (!existing) { notFound = true; return }
    if (!canEditDealRow(role, existing.ownerId, session.user!.id)) { permissionError = true; return }

    if (fields.ownerId && fields.ownerId !== existing.ownerId) {
      const ownerMembership = await tx.membership.findUnique({
        where: { userId_tenantId: { userId: fields.ownerId, tenantId } },
      })
      if (!ownerMembership) { notFound = true; return }
    }

    if (fields.channelKey !== undefined) {
      const channelValid = await isActiveCatalogItemKey(tenantId, "salesChannel", fields.channelKey)
      if (!channelValid) {
        validationError = "El origen seleccionado no es válido o está inactivo."
        return
      }
    }

    const updateData: Prisma.DealUpdateInput = {}
    if (fields.name !== undefined) updateData.name = fields.name.trim()
    if (fields.company !== undefined) updateData.company = fields.company?.trim() || null
    if (fields.phone !== undefined) updateData.phone = fields.phone?.trim() || null
    if (fields.whatsapp !== undefined) updateData.whatsapp = fields.whatsapp?.trim() || null
    if (fields.email !== undefined) updateData.email = fields.email?.trim() || null
    if (fields.value !== undefined) updateData.value = fields.value
    if (fields.statusKey !== undefined) updateData.statusKey = fields.statusKey
    if (fields.channelKey !== undefined) updateData.channelKey = fields.channelKey
    if (fields.ownerId !== undefined) updateData.owner = { connect: { id: fields.ownerId } }

    await tx.deal.update({ where: { id: dealId, tenantId }, data: updateData })

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
  if (permissionError) return { ok: false, error: "Acceso denegado." }
  if (validationError) return { ok: false, error: validationError }
  if (notFound) return { ok: false, error: "Oportunidad no encontrada." }

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  return { ok: true }
}

export async function moveDealAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = moveDealSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, dealId, toStageId, force } = parsed.data

  const role = await getUserRole(session, tenantId)
  if (!role || !canEditDeal(role)) return { ok: false, error: "Acceso denegado." }

  let moveError: string | undefined

  await withTenant(tenantId, async (tx) => {
    const [deal, targetStage] = await Promise.all([
      tx.deal.findUnique({ where: { id: dealId, tenantId }, select: { stageId: true, ownerId: true } }),
      tx.pipelineStage.findUnique({ where: { id: toStageId, tenantId } }),
    ])

    if (!deal) { moveError = "Oportunidad no encontrada."; return }
    if (!canEditDealRow(role, deal.ownerId, session.user!.id)) { moveError = "Acceso denegado."; return }
    if (!targetStage) { moveError = "Etapa no encontrada."; return }
    if (targetStage.locked && !force) {
      if (targetStage.key === "ganado") {
        const paymentWithDoc = await tx.payment.findFirst({
          where: { dealId, tenantId, isVoid: false, fileUrl: { not: null } },
          select: { id: true },
        })
        moveError = paymentWithDoc
          ? `La etapa «${targetStage.label}» está bloqueada. Usa el botón «Marcar como ganado» en el detalle de la oportunidad.`
          : "Para marcar como ganado debes adjuntar un comprobante de pago (PDF o imagen) en «Documentos de Pago»."
      } else if (targetStage.key === "perdido") {
        moveError = `La etapa «${targetStage.label}» está bloqueada. Usa el botón «Marcar como perdido» en el detalle.`
      } else {
        moveError = `La etapa «${targetStage.label}» está bloqueada. Usa las acciones del panel de detalle.`
      }
      return
    }

    if (targetStage.key === "ganado") {
      const paymentWithDoc = await tx.payment.findFirst({
        where: { dealId, tenantId, isVoid: false, fileUrl: { not: null } },
        select: { id: true },
      })
      if (!paymentWithDoc) {
        moveError =
          "Para marcar como ganado debes adjuntar un comprobante de pago (PDF o imagen) en «Documentos de Pago»."
        return
      }
    }

    await tx.deal.update({
      where: { id: dealId, tenantId },
      data: { stageId: toStageId, stageEnteredAt: new Date() },
    })
    await recordActivity(tx, {
      tenantId,
      entity: "Deal",
      entityId: dealId,
      type: "stageChanged",
      payload: { from: deal.stageId, to: toStageId, toLabel: targetStage.label },
      userId: session.user!.id,
    })
  })

  if (moveError) return { ok: false, error: moveError }

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

  const role = await getUserRole(session, tenantId)
  if (!role || !canArchiveDeal(role)) return { ok: false, error: "Acceso denegado." }

  let notFound = false
  await withTenant(tenantId, async (tx) => {
    const deal = await tx.deal.findUnique({ where: { id: dealId, tenantId } })
    if (!deal) { notFound = true; return }
    await tx.deal.update({ where: { id: dealId, tenantId }, data: { isArchived: true } })
    await recordActivity(tx, {
      tenantId,
      entity: "Deal",
      entityId: dealId,
      type: "archived",
      payload: {},
      userId: session.user!.id,
    })
  })
  if (notFound) return { ok: false, error: "Oportunidad no encontrada." }

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

  const role = await getUserRole(session, tenantId)
  if (!role || !canEditDeal(role)) return { ok: false, error: "Acceso denegado." }

  let notFound = false
  let permissionError = false
  await withTenant(tenantId, async (tx) => {
    const deal = await tx.deal.findUnique({
      where: { id: dealId, tenantId },
      select: { ownerId: true, value: true, statusKey: true, phone: true, whatsapp: true, email: true, name: true, company: true },
    })
    if (!deal) { notFound = true; return }
    if (!canEditDealRow(role, deal.ownerId, session.user!.id)) { permissionError = true; return }
    await tx.deal.update({ where: { id: dealId, tenantId }, data: { [field]: value } })
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
  if (permissionError) return { ok: false, error: "Acceso denegado." }
  if (notFound) return { ok: false, error: "Oportunidad no encontrada." }

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  return { ok: true }
}

export async function transferDealAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = transferDealSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, dealId, toUserId } = parsed.data

  const role = await getUserRole(session, tenantId)
  if (!role || !canEditDeal(role)) return { ok: false, error: "Acceso denegado." }

  let notFound = false
  let permissionError = false
  let validationError: string | undefined
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.deal.findUnique({ where: { id: dealId, tenantId }, select: { ownerId: true } })
    if (!existing) { notFound = true; return }
    // Only the current owner (cesión) or a supervisor+ (reasignación) can transfer.
    if (!canEditDealRow(role, existing.ownerId, session.user!.id)) { permissionError = true; return }
    if (existing.ownerId === toUserId) { validationError = "La oportunidad ya pertenece a ese asesor."; return }

    const targetMembership = await tx.membership.findUnique({
      where: { userId_tenantId: { userId: toUserId, tenantId } },
    })
    if (!targetMembership) { validationError = "El asesor seleccionado no pertenece al equipo."; return }

    await tx.deal.update({ where: { id: dealId, tenantId }, data: { ownerId: toUserId } })

    // The previous owner keeps read-only access (cesión); the new owner regains full edit
    // (returning the deal simply removes their viewer grant).
    await tx.dealViewer.deleteMany({ where: { dealId, userId: toUserId } })
    await tx.dealViewer.upsert({
      where: { dealId_userId: { dealId, userId: existing.ownerId } },
      create: { tenantId, dealId, userId: existing.ownerId },
      update: {},
    })

    await recordActivity(tx, {
      tenantId,
      entity: "Deal",
      entityId: dealId,
      type: "ownerChanged",
      payload: { from: existing.ownerId, to: toUserId },
      userId: session.user!.id,
    })
  })
  if (permissionError) return { ok: false, error: "Acceso denegado." }
  if (validationError) return { ok: false, error: validationError }
  if (notFound) return { ok: false, error: "Oportunidad no encontrada." }

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  return { ok: true }
}

export async function deleteDealAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = deleteDealSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, dealId } = parsed.data

  // Only superadmins (OWNER/ADMIN) may permanently delete an opportunity.
  const role = await getUserRole(session, tenantId)
  if (!role || !canDeleteDeal(role)) return { ok: false, error: "Acceso denegado." }

  let notFound = false
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.deal.findUnique({ where: { id: dealId, tenantId }, select: { id: true, name: true } })
    if (!existing) { notFound = true; return }
    await tx.deal.delete({ where: { id: dealId, tenantId } })
    await recordActivity(tx, {
      tenantId,
      entity: "Deal",
      entityId: dealId,
      type: "deleted",
      payload: { name: existing.name },
      userId: session.user!.id,
    })
  })
  if (notFound) return { ok: false, error: "Oportunidad no encontrada." }

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  revalidatePath(`/app/${tenantSlug}/archive`, "page")
  return { ok: true }
}

export async function getDealSummaryAction(raw: unknown): Promise<{
  ok: boolean
  error?: string
  deal?: {
    id: string; name: string; company: string | null; phone: string | null
    whatsapp: string | null; email: string | null; value: number; statusKey: string
    stageId: string; stageKey: string; createdAt: string; stageEnteredAt: string
    ownerId: string; ownerName: string | null
    equipment: { equipmentKey: string; customLabel: string | null }[]
    quoteCount: number; paymentCount: number
  }
}> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = z.object({ tenantId: z.string().min(1), dealId: z.string().min(1) }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, dealId } = parsed.data

  const role = await getUserRole(session, tenantId)
  if (!role) return { ok: false, error: "Acceso denegado." }

  const d = await getDeal(tenantId, dealId, canSeeAllDeals(role) ? undefined : session.user.id)
  if (!d) return { ok: false, error: "Oportunidad no encontrada." }

  return {
    ok: true,
    deal: {
      id: d.id,
      name: d.name,
      company: d.company,
      phone: d.client?.phone ?? d.phone ?? null,
      whatsapp: d.client?.whatsapp ?? d.whatsapp ?? null,
      email: d.client?.email ?? d.email ?? null,
      value: Number(d.value),
      statusKey: d.statusKey,
      stageId: d.stageId,
      stageKey: d.stage.key,
      createdAt: d.createdAt.toISOString(),
      stageEnteredAt: d.stageEnteredAt.toISOString(),
      ownerId: d.ownerId,
      ownerName: d.owner.name,
      equipment: d.equipment,
      quoteCount: d._count.quotes,
      paymentCount: d._count.payments,
    },
  }
}

export async function getDealActivityAction(tenantId: string, dealId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autenticado.")
  await requireRole(session, tenantId, ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"])
  return getDealActivity(tenantId, dealId)
}

export async function getDealFollowUpsAction(tenantId: string, dealId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autenticado.")
  return getDealFollowUps(tenantId, dealId)
}

export async function getQuotesForDealAction(tenantId: string, dealId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autenticado.")
  return getQuotesForDeal(tenantId, dealId)
}

export async function getPaymentsForDealAction(tenantId: string, dealId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autenticado.")
  return getPaymentsForDeal(tenantId, dealId)
}
