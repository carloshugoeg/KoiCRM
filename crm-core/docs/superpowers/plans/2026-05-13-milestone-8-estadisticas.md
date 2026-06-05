# Milestone 8 — Estadísticas, KPIs, Charts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Estadísticas panel (7 sub-tabs: Resumen, Listado, Embudo, Equipo, Canal, Productos, Alertas) with server-side aggregation queries, Recharts visualizations, and a global date-range filter synced via URL params.

**Architecture:** Each sub-tab is a Next.js App Router page under `app/app/[tenantSlug]/stats/<tab>/page.tsx` (server component, fetches its own data via aggregation queries). A shared `stats/layout.tsx` renders the client-side tab nav + `RangePicker`. All pages read `from`/`to` from `searchParams` and pass them to query functions. Recharts chart wrappers are "use client" components in `components/charts/`.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, Recharts, @tanstack/react-table, Tailwind + shadcn/ui, date-fns v4, Vitest integration tests.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `features/stats/queries.ts` | Add all aggregation functions (keeps existing `getPipelineKpis`) |
| Create | `features/stats/components/RangePicker.tsx` | Date preset picker, syncs to URL |
| Create | `features/stats/components/StatsShell.tsx` | Client shell: tab nav + RangePicker |
| Create | `app/app/[tenantSlug]/stats/layout.tsx` | Wraps all stats sub-tabs |
| Create | `app/app/[tenantSlug]/stats/page.tsx` | Redirect to /resumen |
| Create | `app/app/[tenantSlug]/stats/resumen/page.tsx` | KPI cards + top performers |
| Create | `app/app/[tenantSlug]/stats/listado/page.tsx` | Deals table with all filters |
| Create | `app/app/[tenantSlug]/stats/embudo/page.tsx` | Bar chart + per-stage table |
| Create | `app/app/[tenantSlug]/stats/equipo/page.tsx` | Pie + bar + per-owner table |
| Create | `app/app/[tenantSlug]/stats/canal/page.tsx` | Pie + bar + per-channel table |
| Create | `app/app/[tenantSlug]/stats/productos/page.tsx` | Bar + per-equipment table |
| Modify | `app/app/[tenantSlug]/stats/alerts/page.tsx` | Accept from/to searchParams |
| Create | `components/charts/BarChart.tsx` | Recharts BarChart wrapper |
| Create | `components/charts/PieChart.tsx` | Recharts PieChart wrapper |
| Create | `components/data-table/DataTable.tsx` | TanStack Table wrapper |
| Create | `tests/integration/stats-queries.test.ts` | Integration tests for all query functions |
| Modify | `components/app/tenant-header.tsx` | Rename "Alertas" → "Estadísticas" |

---

## Task 1: Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Install recharts and @tanstack/react-table**

```bash
cd /Users/carloshugo/Documents/Projects/KoiCRM/crm-core
pnpm add recharts @tanstack/react-table
```

Expected: packages added to `dependencies` in package.json.

- [ ] **Step 2: Verify TypeScript types resolve**

```bash
pnpm type-check 2>&1 | head -20
```

Expected: no new errors from the added packages.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(M8): add recharts and @tanstack/react-table"
```

---

## Task 2: Aggregation queries — Resumen + Embudo (T8.1)

**Files:**
- Modify: `features/stats/queries.ts`

- [ ] **Step 1: Write failing integration test stubs**

Create `tests/integration/stats-queries.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers"
import {
  getResumenStats,
  getEmbudoStats,
  getEquipoStats,
  getCanalStats,
  getProductosStats,
} from "../../features/stats/queries"

let tenantId: string
let userId: string
let userId2: string
let pipelineId: string
let prospectoId: string
let ganadoId: string
let perdidoId: string

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({
    data: { slug: "stats-test", name: "Stats Test", settings: { create: { dealIdPrefix: "STA" } } },
  })
  tenantId = tenant.id

  const [u1, u2] = await Promise.all([
    prismaAdmin.user.create({ data: { email: "asesor1@test.com", name: "Asesor Uno" } }),
    prismaAdmin.user.create({ data: { email: "asesor2@test.com", name: "Asesor Dos" } }),
  ])
  userId = u1.id
  userId2 = u2.id

  await prismaAdmin.membership.createMany({
    data: [
      { tenantId, userId, role: "OWNER" },
      { tenantId, userId: userId2, role: "MEMBER" },
    ],
  })

  const pipeline = await prismaAdmin.pipeline.create({
    data: {
      tenantId,
      name: "Main",
      isDefault: true,
      stages: {
        create: [
          { tenantId, order: 0, key: "prospecto", label: "Prospecto", color: "#6366f1", iconKey: "circle" },
          { tenantId, order: 3, key: "ganado", label: "Ganado", color: "#22c55e", iconKey: "check" },
          { tenantId, order: 4, key: "perdido", label: "Perdido", color: "#ef4444", iconKey: "x" },
        ],
      },
    },
    include: { stages: true },
  })
  pipelineId = pipeline.id
  prospectoId = pipeline.stages.find((s) => s.key === "prospecto")!.id
  ganadoId = pipeline.stages.find((s) => s.key === "ganado")!.id
  perdidoId = pipeline.stages.find((s) => s.key === "perdido")!.id

  await prismaAdmin.catalogItem.createMany({
    data: [
      { tenantId, catalogKey: "salesChannel", key: "whatsapp", label: "WhatsApp" },
      { tenantId, catalogKey: "salesChannel", key: "sala", label: "Sala" },
      { tenantId, catalogKey: "equipment", key: "bomba", label: "Bomba" },
      { tenantId, catalogKey: "equipment", key: "jacuzzi", label: "Jacuzzi" },
    ],
  })

  // 2 active deals (userId), 1 won (userId2), 1 lost (userId)
  await prismaAdmin.deal.createMany({
    data: [
      { id: "STA-0001", tenantId, pipelineId, stageId: prospectoId, ownerId: userId, channelKey: "whatsapp", statusKey: "active", name: "Deal 1", value: 1000 },
      { id: "STA-0002", tenantId, pipelineId, stageId: prospectoId, ownerId: userId, channelKey: "sala", statusKey: "active", name: "Deal 2", value: 2000 },
      { id: "STA-0003", tenantId, pipelineId, stageId: ganadoId, ownerId: userId2, channelKey: "whatsapp", statusKey: "active", name: "Deal 3 (won)", value: 3000 },
      { id: "STA-0004", tenantId, pipelineId, stageId: perdidoId, ownerId: userId, channelKey: "sala", statusKey: "active", name: "Deal 4 (lost)", value: 500 },
    ],
  })

  await prismaAdmin.dealEquipment.createMany({
    data: [
      { dealId: "STA-0001", equipmentKey: "bomba" },
      { dealId: "STA-0002", equipmentKey: "bomba" },
      { dealId: "STA-0003", equipmentKey: "jacuzzi" },
    ],
  })
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

describe("T8.1 — Stats aggregation queries", () => {
  it("getResumenStats: computes KPIs correctly", async () => {
    const stats = await getResumenStats(tenantId, {})
    expect(stats.totalEmbudo).toBe(3000)   // deal1 + deal2 (not won/lost)
    expect(stats.ganado).toBe(3000)         // deal3
    expect(stats.perdido).toBe(500)         // deal4
    // tasaCierre = wonCount(1) / activeCount(4) * 100 = 25
    expect(stats.tasaCierre).toBeCloseTo(25)
    // ticketPromedio = totalEmbudo(3000) / activeCountOpen(2)
    expect(stats.ticketPromedio).toBe(1500)
    expect(stats.topPerformers.length).toBeGreaterThan(0)
  })

  it("getEmbudoStats: returns per-stage counts and values", async () => {
    const stages = await getEmbudoStats(tenantId, {})
    const prospecto = stages.find((s) => s.stageKey === "prospecto")
    expect(prospecto?.count).toBe(2)
    expect(prospecto?.value).toBe(3000)
    const ganado = stages.find((s) => s.stageKey === "ganado")
    expect(ganado?.count).toBe(1)
    expect(ganado?.value).toBe(3000)
  })

  it("getEquipoStats: returns per-owner aggregates", async () => {
    const team = await getEquipoStats(tenantId, {})
    const a1 = team.find((r) => r.ownerId === userId)
    expect(a1?.dealsCount).toBe(3) // deal1, deal2, deal4
    expect(a1?.wonCount).toBe(0)
    expect(a1?.lostCount).toBe(1)
    const a2 = team.find((r) => r.ownerId === userId2)
    expect(a2?.dealsCount).toBe(1)
    expect(a2?.wonCount).toBe(1)
    expect(a2?.wonValue).toBe(3000)
  })

  it("getCanalStats: returns per-channel aggregates", async () => {
    const channels = await getCanalStats(tenantId, {})
    const wa = channels.find((c) => c.channelKey === "whatsapp")
    expect(wa?.dealsCount).toBe(2) // deal1, deal3
    expect(wa?.wonCount).toBe(1)
  })

  it("getProductosStats: returns per-equipment demand/sold counts", async () => {
    const products = await getProductosStats(tenantId, {})
    const bomba = products.find((p) => p.equipmentKey === "bomba")
    expect(bomba?.demandCount).toBe(2) // deal1, deal2 (not won)
    expect(bomba?.soldCount).toBe(0)
    const jacuzzi = products.find((p) => p.equipmentKey === "jacuzzi")
    expect(jacuzzi?.soldCount).toBe(1) // deal3 is won
    expect(jacuzzi?.soldValue).toBe(3000)
  })

  it("getResumenStats: date filter excludes deals outside range", async () => {
    const future = new Date(Date.now() + 86400000 * 365)
    const stats = await getResumenStats(tenantId, { from: future })
    expect(stats.totalEmbudo).toBe(0)
    expect(stats.ganado).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to see it fail (missing exports)**

```bash
cd /Users/carloshugo/Documents/Projects/KoiCRM/crm-core
pnpm test:integration -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|Error|getResumenStats" | head -20
```

Expected: FAIL — "getResumenStats is not a function" or import error.

- [ ] **Step 3: Implement StatsFilters + getResumenStats + getEmbudoStats in features/stats/queries.ts**

Replace entire `features/stats/queries.ts` with:

```typescript
import { prisma } from "@/lib/db/client"
import { withTenant } from "@/lib/db/rls"
import type { Prisma } from "@prisma/client"
import type { PipelineFilters } from "@/features/deals/queries"

export interface StatsFilters {
  from?: Date
  to?: Date
  ownerId?: string
}

// ── Shared helper ────────────────────────────────────────────────────────────

async function getStageKeys(tenantId: string) {
  const stages = await prisma.pipelineStage.findMany({
    where: { tenantId },
    select: { id: true, key: true, label: true, color: true, order: true },
    orderBy: { order: "asc" },
  })
  return {
    stages,
    wonIds: stages.filter((s) => s.key === "ganado").map((s) => s.id),
    lostIds: stages.filter((s) => s.key === "perdido").map((s) => s.id),
    closedIds: stages.filter((s) => s.key === "ganado" || s.key === "perdido").map((s) => s.id),
  }
}

function dateFilter(filters: StatsFilters): Prisma.DealWhereInput {
  if (!filters.from && !filters.to) return {}
  return {
    createdAt: {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    },
  }
}

// ── T5.4 — Pipeline header KPIs (keep existing) ──────────────────────────────

export async function getPipelineKpis(tenantId: string, filters: PipelineFilters = {}) {
  const baseWhere: Prisma.DealWhereInput = { tenantId, isArchived: false }
  if (filters.ownerId) baseWhere.ownerId = filters.ownerId
  if (filters.channelKey) baseWhere.channelKey = filters.channelKey
  if (filters.from || filters.to) {
    baseWhere.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    }
  }
  if (filters.equipmentKey) {
    baseWhere.equipment = { some: { equipmentKey: filters.equipmentKey } }
  }

  const stages = await prisma.pipelineStage.findMany({
    where: { tenantId },
    select: { id: true, key: true },
  })
  const wonStageIds = stages.filter((s) => s.key === "ganado").map((s) => s.id)
  const closedStageIds = stages.filter((s) => s.key === "ganado" || s.key === "perdido").map((s) => s.id)

  const [pipelineAgg, wonAgg] = await Promise.all([
    prisma.deal.aggregate({
      where: { ...baseWhere, stageId: { notIn: closedStageIds.length ? closedStageIds : ["__none__"] } },
      _sum: { value: true },
    }),
    prisma.deal.aggregate({
      where: { ...baseWhere, stageId: { in: wonStageIds.length ? wonStageIds : ["__none__"] } },
      _sum: { value: true },
    }),
  ])

  return {
    totalPipeline: Number(pipelineAgg._sum.value ?? 0),
    totalWon: Number(wonAgg._sum.value ?? 0),
  }
}

// ── T8.1 — Stats aggregations ─────────────────────────────────────────────────

export async function getResumenStats(tenantId: string, filters: StatsFilters) {
  const { wonIds, lostIds, closedIds } = await getStageKeys(tenantId)
  const df = dateFilter(filters)
  const ownerFilter = filters.ownerId ? { ownerId: filters.ownerId } : {}
  const base: Prisma.DealWhereInput = { tenantId, isArchived: false, ...df, ...ownerFilter }
  const openWhere = { ...base, stageId: { notIn: closedIds.length ? closedIds : ["__none__"] } }
  const wonWhere = { ...base, stageId: { in: wonIds.length ? wonIds : ["__none__"] } }
  const lostWhere = { ...base, stageId: { in: lostIds.length ? lostIds : ["__none__"] } }

  const [allCount, allSum, openSum, wonAgg, lostAgg, topPerformersRaw] = await withTenant(
    tenantId,
    (tx) =>
      Promise.all([
        tx.deal.count({ where: base }),
        tx.deal.aggregate({ where: base, _count: { id: true } }),
        tx.deal.aggregate({ where: openWhere, _sum: { value: true }, _count: { id: true } }),
        tx.deal.aggregate({ where: wonWhere, _sum: { value: true }, _count: { id: true } }),
        tx.deal.aggregate({ where: lostWhere, _sum: { value: true }, _count: { id: true } }),
        tx.deal.groupBy({
          by: ["ownerId"],
          where: wonWhere,
          _sum: { value: true },
          _count: { id: true },
          orderBy: { _sum: { value: "desc" } },
          take: 5,
        }),
      ])
  )

  const ownerIds = topPerformersRaw.map((r) => r.ownerId)
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true, email: true },
      })
    : []

  const topPerformers = topPerformersRaw.map((r) => {
    const u = owners.find((o) => o.id === r.ownerId)
    return {
      ownerId: r.ownerId,
      ownerName: u?.name ?? u?.email ?? r.ownerId,
      wonValue: Number(r._sum.value ?? 0),
      wonCount: r._count.id,
    }
  })

  const activeCount = allCount
  const wonCount = wonAgg._count.id
  const activeCountOpen = openSum._count.id
  const totalEmbudo = Number(openSum._sum.value ?? 0)

  return {
    totalEmbudo,
    ganado: Number(wonAgg._sum.value ?? 0),
    perdido: Number(lostAgg._sum.value ?? 0),
    tasaCierre: Math.round((wonCount / Math.max(activeCount, 1)) * 100 * 10) / 10,
    ticketPromedio: activeCountOpen > 0 ? Math.round(totalEmbudo / activeCountOpen) : 0,
    topPerformers,
  }
}

export type ResumenStats = Awaited<ReturnType<typeof getResumenStats>>

export async function getEmbudoStats(tenantId: string, filters: StatsFilters) {
  const { stages } = await getStageKeys(tenantId)
  const df = dateFilter(filters)
  const ownerFilter = filters.ownerId ? { ownerId: filters.ownerId } : {}

  const byStage = await withTenant(tenantId, (tx) =>
    tx.deal.groupBy({
      by: ["stageId"],
      where: { tenantId, isArchived: false, ...df, ...ownerFilter },
      _sum: { value: true },
      _count: { id: true },
    })
  )

  return stages.map((stage) => {
    const row = byStage.find((r) => r.stageId === stage.id)
    return {
      stageId: stage.id,
      stageKey: stage.key,
      stageLabel: stage.label,
      stageColor: stage.color,
      stageOrder: stage.order,
      count: row?._count.id ?? 0,
      value: Number(row?._sum.value ?? 0),
    }
  })
}

export type EmbudoStats = Awaited<ReturnType<typeof getEmbudoStats>>

export async function getEquipoStats(tenantId: string, filters: StatsFilters) {
  const { wonIds, lostIds } = await getStageKeys(tenantId)
  const df = dateFilter(filters)
  const base: Prisma.DealWhereInput = { tenantId, isArchived: false, ...df }

  const [allByOwner, wonByOwner, lostByOwner] = await withTenant(tenantId, (tx) =>
    Promise.all([
      tx.deal.groupBy({
        by: ["ownerId"],
        where: base,
        _sum: { value: true },
        _count: { id: true },
      }),
      tx.deal.groupBy({
        by: ["ownerId"],
        where: { ...base, stageId: { in: wonIds.length ? wonIds : ["__none__"] } },
        _sum: { value: true },
        _count: { id: true },
      }),
      tx.deal.groupBy({
        by: ["ownerId"],
        where: { ...base, stageId: { in: lostIds.length ? lostIds : ["__none__"] } },
        _count: { id: true },
      }),
    ])
  )

  const ownerIds = [...new Set(allByOwner.map((r) => r.ownerId))]
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true, email: true },
      })
    : []

  return allByOwner.map((row) => {
    const u = owners.find((o) => o.id === row.ownerId)
    const won = wonByOwner.find((r) => r.ownerId === row.ownerId)
    const lost = lostByOwner.find((r) => r.ownerId === row.ownerId)
    const dealsCount = row._count.id
    const wonCount = won?._count.id ?? 0
    const lostCount = lost?._count.id ?? 0
    return {
      ownerId: row.ownerId,
      ownerName: u?.name ?? u?.email ?? row.ownerId,
      dealsCount,
      wonCount,
      lostCount,
      closingRate: Math.round((wonCount / Math.max(dealsCount, 1)) * 100 * 10) / 10,
      totalValue: Number(row._sum.value ?? 0),
      wonValue: Number(won?._sum.value ?? 0),
    }
  })
}

export type EquipoStats = Awaited<ReturnType<typeof getEquipoStats>>

export async function getCanalStats(tenantId: string, filters: StatsFilters) {
  const { wonIds } = await getStageKeys(tenantId)
  const df = dateFilter(filters)
  const ownerFilter = filters.ownerId ? { ownerId: filters.ownerId } : {}
  const base: Prisma.DealWhereInput = { tenantId, isArchived: false, ...df, ...ownerFilter }

  const [allByChannel, wonByChannel, channelCatalog] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.deal.groupBy({
        by: ["channelKey"],
        where: base,
        _sum: { value: true },
        _count: { id: true },
      })
    ),
    withTenant(tenantId, (tx) =>
      tx.deal.groupBy({
        by: ["channelKey"],
        where: { ...base, stageId: { in: wonIds.length ? wonIds : ["__none__"] } },
        _sum: { value: true },
        _count: { id: true },
      })
    ),
    prisma.catalogItem.findMany({
      where: { tenantId, catalogKey: "salesChannel" },
      select: { key: true, label: true },
    }),
  ])

  return allByChannel.map((row) => {
    const won = wonByChannel.find((r) => r.channelKey === row.channelKey)
    const cat = channelCatalog.find((c) => c.key === row.channelKey)
    return {
      channelKey: row.channelKey,
      channelLabel: cat?.label ?? row.channelKey,
      dealsCount: row._count.id,
      totalValue: Number(row._sum.value ?? 0),
      wonCount: won?._count.id ?? 0,
      wonValue: Number(won?._sum.value ?? 0),
    }
  })
}

export type CanalStats = Awaited<ReturnType<typeof getCanalStats>>

export async function getProductosStats(tenantId: string, filters: StatsFilters) {
  const { wonIds, closedIds } = await getStageKeys(tenantId)
  const df = dateFilter(filters)
  const ownerFilter = filters.ownerId ? { ownerId: filters.ownerId } : {}
  const base: Prisma.DealWhereInput = { tenantId, isArchived: false, ...df, ...ownerFilter }

  const [demandDeals, wonDeals, equipmentCatalog] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.deal.findMany({
        where: { ...base, stageId: { notIn: closedIds.length ? closedIds : ["__none__"] } },
        select: { value: true, equipment: { select: { equipmentKey: true } } },
      })
    ),
    withTenant(tenantId, (tx) =>
      tx.deal.findMany({
        where: { ...base, stageId: { in: wonIds.length ? wonIds : ["__none__"] } },
        select: { value: true, equipment: { select: { equipmentKey: true } } },
      })
    ),
    prisma.catalogItem.findMany({
      where: { tenantId, catalogKey: "equipment" },
      select: { key: true, label: true },
    }),
  ])

  const map = new Map<string, { demandCount: number; soldCount: number; pendingValue: number; soldValue: number }>()

  for (const deal of demandDeals) {
    for (const eq of deal.equipment) {
      const e = map.get(eq.equipmentKey) ?? { demandCount: 0, soldCount: 0, pendingValue: 0, soldValue: 0 }
      e.demandCount++
      e.pendingValue += Number(deal.value)
      map.set(eq.equipmentKey, e)
    }
  }
  for (const deal of wonDeals) {
    for (const eq of deal.equipment) {
      const e = map.get(eq.equipmentKey) ?? { demandCount: 0, soldCount: 0, pendingValue: 0, soldValue: 0 }
      e.soldCount++
      e.soldValue += Number(deal.value)
      map.set(eq.equipmentKey, e)
    }
  }

  return Array.from(map.entries())
    .map(([equipmentKey, data]) => {
      const cat = equipmentCatalog.find((c) => c.key === equipmentKey)
      return { equipmentKey, equipmentLabel: cat?.label ?? equipmentKey, ...data }
    })
    .sort((a, b) => b.demandCount + b.soldCount - (a.demandCount + a.soldCount))
}

export type ProductosStats = Awaited<ReturnType<typeof getProductosStats>>
```

- [ ] **Step 4: Run integration tests**

```bash
pnpm test:integration 2>&1 | tail -20
```

Expected: all 5 tests in "T8.1 — Stats aggregation queries" PASS.

- [ ] **Step 5: Commit**

```bash
git add features/stats/queries.ts tests/integration/stats-queries.test.ts
git commit -m "feat(T8.1): add stats aggregation queries (resumen, embudo, equipo, canal, productos)"
```

---

## Task 3: RangePicker component (T8.3)

**Files:**
- Create: `features/stats/components/RangePicker.tsx`

- [ ] **Step 1: Create RangePicker.tsx**

```tsx
// features/stats/components/RangePicker.tsx
"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback } from "react"
import { Button } from "@/components/ui/button"

type Preset = "all" | "today" | "week" | "month" | "quarter" | "year" | "custom"

const PRESETS: { key: Preset; label: string }[] = [
  { key: "all", label: "Todo" },
  { key: "today", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "quarter", label: "Trimestre" },
  { key: "year", label: "Año" },
  { key: "custom", label: "Personalizado" },
]

function toISODate(d: Date) {
  return d.toISOString().split("T")[0]
}

function getPresetRange(preset: Preset): { from: string; to: string } | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (preset === "all") return null
  if (preset === "today") {
    const s = toISODate(today)
    return { from: s, to: s }
  }
  if (preset === "week") {
    const day = today.getDay()
    const mon = new Date(today)
    mon.setDate(today.getDate() - ((day + 6) % 7))
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    return { from: toISODate(mon), to: toISODate(sun) }
  }
  if (preset === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: toISODate(first), to: toISODate(last) }
  }
  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3)
    const first = new Date(now.getFullYear(), q * 3, 1)
    const last = new Date(now.getFullYear(), q * 3 + 3, 0)
    return { from: toISODate(first), to: toISODate(last) }
  }
  if (preset === "year") {
    const first = new Date(now.getFullYear(), 0, 1)
    const last = new Date(now.getFullYear(), 11, 31)
    return { from: toISODate(first), to: toISODate(last) }
  }
  return null
}

export function RangePicker() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""

  const activePreset: Preset = (() => {
    if (!from && !to) return "all"
    const today = toISODate(new Date())
    if (from === today && to === today) return "today"
    const range = { from, to }
    for (const p of PRESETS.filter((p) => p.key !== "all" && p.key !== "custom")) {
      const r = getPresetRange(p.key)
      if (r?.from === range.from && r?.to === range.to) return p.key
    }
    return "custom"
  })()

  const navigate = useCallback(
    (params: URLSearchParams) => {
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname]
  )

  function applyPreset(preset: Preset) {
    const params = new URLSearchParams(searchParams.toString())
    if (preset === "all") {
      params.delete("from")
      params.delete("to")
    } else if (preset !== "custom") {
      const r = getPresetRange(preset)
      if (r) {
        params.set("from", r.from)
        params.set("to", r.to)
      }
    }
    navigate(params)
  }

  function applyCustom(field: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(field, value)
    else params.delete(field)
    navigate(params)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.filter((p) => p.key !== "custom").map((p) => (
        <button
          key={p.key}
          onClick={() => applyPreset(p.key)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            activePreset === p.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-1 ml-1">
        <input
          type="date"
          value={from}
          onChange={(e) => applyCustom("from", e.target.value)}
          className="h-7 rounded border text-xs px-2 bg-background w-32"
        />
        <span className="text-xs text-muted-foreground">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => applyCustom("to", e.target.value)}
          className="h-7 rounded border text-xs px-2 bg-background w-32"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm type-check 2>&1 | grep -i "RangePicker\|features/stats" | head -10
```

Expected: no errors.

---

## Task 4: Stats shell (StatsShell client component)

**Files:**
- Create: `features/stats/components/StatsShell.tsx`

- [ ] **Step 1: Create StatsShell.tsx**

```tsx
// features/stats/components/StatsShell.tsx
"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { RangePicker } from "./RangePicker"

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "listado", label: "Listado" },
  { key: "embudo", label: "Embudo" },
  { key: "equipo", label: "Equipo" },
  { key: "canal", label: "Canal" },
  { key: "productos", label: "Productos" },
  { key: "alerts", label: "Alertas" },
] as const

export function StatsShell({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const qs = searchParams.toString()

  function tabHref(key: string) {
    const base = `/app/${tenantSlug}/stats/${key}`
    return qs ? `${base}?${qs}` : base
  }

  function isActive(key: string) {
    return pathname.includes(`/stats/${key}`)
  }

  return (
    <div className="border-b bg-background px-4 pt-3 pb-0">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <h1 className="text-base font-semibold">Estadísticas</h1>
        <RangePicker />
      </div>
      <nav className="flex gap-0 -mb-px overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tabHref(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              isActive(tab.key)
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
```

---

## Task 5: Stats layout, redirect page, and TenantHeader update

**Files:**
- Create: `app/app/[tenantSlug]/stats/layout.tsx`
- Create: `app/app/[tenantSlug]/stats/page.tsx`
- Modify: `components/app/tenant-header.tsx`

- [ ] **Step 1: Create stats layout**

```tsx
// app/app/[tenantSlug]/stats/layout.tsx
import { Suspense } from "react"
import { StatsShell } from "@/features/stats/components/StatsShell"

interface Props {
  children: React.ReactNode
  params: { tenantSlug: string }
}

export default function StatsLayout({ children, params }: Props) {
  return (
    <div className="flex flex-col h-full">
      <Suspense>
        <StatsShell tenantSlug={params.tenantSlug} />
      </Suspense>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Create stats/page.tsx redirect**

```tsx
// app/app/[tenantSlug]/stats/page.tsx
import { redirect } from "next/navigation"

export default function StatsPage({ params }: { params: { tenantSlug: string } }) {
  redirect(`/app/${params.tenantSlug}/stats/resumen`)
}
```

- [ ] **Step 3: Update TenantHeader — rename "Alertas" → "Estadísticas"**

In `components/app/tenant-header.tsx`, change:

```tsx
// OLD:
<Link href={`/app/${tenant.slug}/stats`} className={navClass(`/app/${tenant.slug}/stats`)}>
  Alertas
</Link>
```

to:

```tsx
// NEW:
<Link href={`/app/${tenant.slug}/stats`} className={navClass(`/app/${tenant.slug}/stats`)}>
  Estadísticas
</Link>
```

- [ ] **Step 4: Type-check**

```bash
pnpm type-check 2>&1 | grep -E "stats|layout|StatsShell" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add features/stats/components/ app/app/\[tenantSlug\]/stats/layout.tsx app/app/\[tenantSlug\]/stats/page.tsx components/app/tenant-header.tsx
git commit -m "feat(T8.2,T8.3): add stats layout, StatsShell, RangePicker, rename nav link to Estadísticas"
```

---

## Task 6: Chart wrapper components (T8.2)

**Files:**
- Create: `components/charts/BarChart.tsx`
- Create: `components/charts/PieChart.tsx`

- [ ] **Step 1: Create BarChart.tsx**

```tsx
// components/charts/BarChart.tsx
"use client"

import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface BarChartProps {
  data: { label: string; value: number; color?: string }[]
  formatter?: (value: number) => string
  height?: number
}

export function BarChart({ data, formatter, height = 220 }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatter} />
        <Tooltip
          formatter={(v: number) => [formatter ? formatter(v) : v, ""]}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? "#6366f1"} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Create PieChart.tsx**

```tsx
// components/charts/PieChart.tsx
"use client"

import {
  PieChart as RePieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface PieChartProps {
  data: { label: string; value: number; color?: string }[]
  formatter?: (value: number) => string
  height?: number
}

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"]

export function PieChart({ data, formatter, height = 220 }: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RePieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number) => [formatter ? formatter(v) : v, ""]}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
      </RePieChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm type-check 2>&1 | grep "charts" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/charts/
git commit -m "feat(T8.2): add BarChart and PieChart Recharts wrappers"
```

---

## Task 7: DataTable component

**Files:**
- Create: `components/data-table/DataTable.tsx`

- [ ] **Step 1: Create DataTable.tsx**

```tsx
// components/data-table/DataTable.tsx
"use client"

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table"

interface DataTableProps<TData> {
  data: TData[]
  columns: ColumnDef<TData, unknown>[]
}

export function DataTable<TData>({ data, columns }: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b bg-muted/50">
              {hg.headers.map((h) => (
                <th key={h.id} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground text-xs">
                Sin datos
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm type-check 2>&1 | grep "data-table" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/data-table/
git commit -m "feat(T8.2): add DataTable component (TanStack Table wrapper)"
```

---

## Task 8: Resumen sub-tab page

**Files:**
- Create: `app/app/[tenantSlug]/stats/resumen/page.tsx`

- [ ] **Step 1: Create resumen/page.tsx**

```tsx
// app/app/[tenantSlug]/stats/resumen/page.tsx
import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getResumenStats } from "@/features/stats/queries"
import { prisma } from "@/lib/db/client"
import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function ResumenPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const tenantId = tenant.id

  const from = searchParams.from ? new Date(searchParams.from as string) : undefined
  const to = searchParams.to ? new Date(searchParams.to as string) : undefined

  const [stats, settings] = await Promise.all([
    getResumenStats(tenantId, { from, to }),
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
  ])

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }

  const fmt = (n: number) => formatCurrency(n, intl)

  const kpis = [
    { label: "Total Embudo", value: fmt(stats.totalEmbudo) },
    { label: "Ganado", value: fmt(stats.ganado) },
    { label: "Perdido", value: fmt(stats.perdido) },
    { label: "Tasa de cierre", value: `${stats.tasaCierre}%` },
    { label: "Ticket promedio", value: fmt(stats.ticketPromedio) },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className="text-lg font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      {stats.topPerformers.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Top Asesores</h2>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Asesor</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Deals ganados</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Valor ganado</th>
                </tr>
              </thead>
              <tbody>
                {stats.topPerformers.map((p, i) => (
                  <tr key={p.ownerId} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{p.ownerName}</td>
                    <td className="px-3 py-2 text-right">{p.wonCount}</td>
                    <td className="px-3 py-2 text-right">{fmt(p.wonValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm type-check 2>&1 | grep "resumen" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/app/\[tenantSlug\]/stats/resumen/
git commit -m "feat(T8.2): add Resumen stats sub-tab page"
```

---

## Task 9: Listado sub-tab page

**Files:**
- Create: `app/app/[tenantSlug]/stats/listado/page.tsx`

- [ ] **Step 1: Create listado/page.tsx**

```tsx
// app/app/[tenantSlug]/stats/listado/page.tsx
import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getPipelineDeals } from "@/features/deals/queries"
import { prisma } from "@/lib/db/client"
import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function ListadoPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const tenantId = tenant.id

  const from = searchParams.from ? new Date(searchParams.from as string) : undefined
  const to = searchParams.to ? new Date(searchParams.to as string) : undefined

  const [deals, settings] = await Promise.all([
    getPipelineDeals(tenantId, { from, to }),
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
  ])

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const fmt = (n: number) => formatCurrency(n, intl)

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Listado de deals</h2>
        <span className="text-xs text-muted-foreground">{deals.length} registros</span>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {["ID", "Nombre", "Empresa", "Asesor", "Etapa", "Canal", "Valor", "Fecha"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">Sin deals en este rango</td>
              </tr>
            ) : (
              deals.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-mono text-xs">{d.id}</td>
                  <td className="px-3 py-2 font-medium max-w-[160px] truncate">{d.name}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{d.company ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{d.owner?.name ?? d.owner?.email ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: d.stage.color + "22", color: d.stage.color }}>
                      {d.stage.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">{d.channelKey}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmt(Number(d.value))}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {new Date(d.createdAt).toLocaleDateString(intl.locale)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm type-check 2>&1 | grep "listado" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/app/\[tenantSlug\]/stats/listado/
git commit -m "feat(T8.2): add Listado stats sub-tab page"
```

---

## Task 10: Embudo sub-tab page

**Files:**
- Create: `app/app/[tenantSlug]/stats/embudo/page.tsx`

- [ ] **Step 1: Create embudo/page.tsx**

```tsx
// app/app/[tenantSlug]/stats/embudo/page.tsx
import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getEmbudoStats } from "@/features/stats/queries"
import { prisma } from "@/lib/db/client"
import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import { BarChart } from "@/components/charts/BarChart"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function EmbudoStatsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const from = searchParams.from ? new Date(searchParams.from as string) : undefined
  const to = searchParams.to ? new Date(searchParams.to as string) : undefined

  const [stages, settings] = await Promise.all([
    getEmbudoStats(tenant.id, { from, to }),
    prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } }),
  ])

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const fmt = (n: number) => formatCurrency(n, intl)

  const chartData = stages.map((s) => ({ label: s.stageLabel, value: s.count, color: s.stageColor }))
  const valueData = stages.map((s) => ({ label: s.stageLabel, value: s.value, color: s.stageColor }))

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-4">Deals por etapa</h2>
          <BarChart data={chartData} />
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-4">Valor por etapa</h2>
          <BarChart data={valueData} formatter={fmt} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Detalle por etapa</h2>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Etapa", "Deals", "Valor"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.stageId} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.stageColor }} />
                      {s.stageLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2">{s.count}</td>
                  <td className="px-3 py-2">{fmt(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm type-check 2>&1 | grep "embudo" | head -5
git add app/app/\[tenantSlug\]/stats/embudo/
git commit -m "feat(T8.2): add Embudo stats sub-tab page with bar charts"
```

---

## Task 11: Equipo sub-tab page

**Files:**
- Create: `app/app/[tenantSlug]/stats/equipo/page.tsx`

- [ ] **Step 1: Create equipo/page.tsx**

```tsx
// app/app/[tenantSlug]/stats/equipo/page.tsx
import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getEquipoStats } from "@/features/stats/queries"
import { prisma } from "@/lib/db/client"
import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import { BarChart } from "@/components/charts/BarChart"
import { PieChart } from "@/components/charts/PieChart"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function EquipoStatsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const from = searchParams.from ? new Date(searchParams.from as string) : undefined
  const to = searchParams.to ? new Date(searchParams.to as string) : undefined

  const [team, settings] = await Promise.all([
    getEquipoStats(tenant.id, { from, to }),
    prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } }),
  ])

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const fmt = (n: number) => formatCurrency(n, intl)

  const pieData = team.map((r) => ({ label: r.ownerName, value: r.dealsCount }))
  const barData = team.map((r) => ({ label: r.ownerName, value: r.wonValue }))

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-4">Deals por asesor</h2>
          <PieChart data={pieData} />
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-4">Valor ganado por asesor</h2>
          <BarChart data={barData} formatter={fmt} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Detalle por asesor</h2>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Asesor", "Deals", "Ganados", "Perdidos", "Tasa cierre", "Valor total", "Valor ganado"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.map((r) => (
                <tr key={r.ownerId} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{r.ownerName}</td>
                  <td className="px-3 py-2">{r.dealsCount}</td>
                  <td className="px-3 py-2">{r.wonCount}</td>
                  <td className="px-3 py-2">{r.lostCount}</td>
                  <td className="px-3 py-2">{r.closingRate}%</td>
                  <td className="px-3 py-2">{fmt(r.totalValue)}</td>
                  <td className="px-3 py-2 font-medium text-green-600">{fmt(r.wonValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm type-check 2>&1 | grep "equipo" | head -5
git add app/app/\[tenantSlug\]/stats/equipo/
git commit -m "feat(T8.2): add Equipo stats sub-tab page with pie and bar charts"
```

---

## Task 12: Canal sub-tab page

**Files:**
- Create: `app/app/[tenantSlug]/stats/canal/page.tsx`

- [ ] **Step 1: Create canal/page.tsx**

```tsx
// app/app/[tenantSlug]/stats/canal/page.tsx
import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getCanalStats } from "@/features/stats/queries"
import { prisma } from "@/lib/db/client"
import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import { BarChart } from "@/components/charts/BarChart"
import { PieChart } from "@/components/charts/PieChart"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function CanalStatsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const from = searchParams.from ? new Date(searchParams.from as string) : undefined
  const to = searchParams.to ? new Date(searchParams.to as string) : undefined

  const [channels, settings] = await Promise.all([
    getCanalStats(tenant.id, { from, to }),
    prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } }),
  ])

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const fmt = (n: number) => formatCurrency(n, intl)

  const pieData = channels.map((c) => ({ label: c.channelLabel, value: c.dealsCount }))
  const barData = channels.map((c) => ({ label: c.channelLabel, value: c.totalValue }))

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-4">Deals por canal</h2>
          <PieChart data={pieData} />
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-4">Valor por canal</h2>
          <BarChart data={barData} formatter={fmt} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Detalle por canal</h2>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Canal", "Deals", "Valor total", "Ganados", "Valor ganado"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.channelKey} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{c.channelLabel}</td>
                  <td className="px-3 py-2">{c.dealsCount}</td>
                  <td className="px-3 py-2">{fmt(c.totalValue)}</td>
                  <td className="px-3 py-2">{c.wonCount}</td>
                  <td className="px-3 py-2 font-medium text-green-600">{fmt(c.wonValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check + commit**

```bash
pnpm type-check 2>&1 | grep "canal" | head -5
git add app/app/\[tenantSlug\]/stats/canal/
git commit -m "feat(T8.2): add Canal stats sub-tab page with pie and bar charts"
```

---

## Task 13: Productos sub-tab page

**Files:**
- Create: `app/app/[tenantSlug]/stats/productos/page.tsx`

- [ ] **Step 1: Create productos/page.tsx**

```tsx
// app/app/[tenantSlug]/stats/productos/page.tsx
import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getProductosStats } from "@/features/stats/queries"
import { prisma } from "@/lib/db/client"
import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import { BarChart } from "@/components/charts/BarChart"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function ProductosStatsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const from = searchParams.from ? new Date(searchParams.from as string) : undefined
  const to = searchParams.to ? new Date(searchParams.to as string) : undefined

  const [products, settings] = await Promise.all([
    getProductosStats(tenant.id, { from, to }),
    prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } }),
  ])

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const fmt = (n: number) => formatCurrency(n, intl)

  const barData = products.map((p) => ({
    label: p.equipmentLabel,
    value: p.demandCount + p.soldCount,
  }))

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold mb-4">Demanda por producto</h2>
        <BarChart data={barData} />
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Detalle por producto</h2>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Producto", "Demanda", "Vendidos", "Valor pendiente", "Valor vendido"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-xs text-muted-foreground">Sin productos en este rango</td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.equipmentKey} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{p.equipmentLabel}</td>
                    <td className="px-3 py-2">{p.demandCount}</td>
                    <td className="px-3 py-2">{p.soldCount}</td>
                    <td className="px-3 py-2">{fmt(p.pendingValue)}</td>
                    <td className="px-3 py-2 font-medium text-green-600">{fmt(p.soldValue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update alerts page to accept from/to searchParams**

In `app/app/[tenantSlug]/stats/alerts/page.tsx`, add `from`/`to` from searchParams and pass to `getFollowUpAlerts`:

The function `getFollowUpAlerts` signature is:
```typescript
getFollowUpAlerts(tenantId: string, ownerId?: string)
```

Update the call in alerts/page.tsx to also pass `from`/`to` as deal filters. Since `getFollowUpAlerts` doesn't currently accept date filters on deal.createdAt, **first update `features/follow-ups/queries.ts`** to accept a `dealCreatedFrom`/`dealCreatedTo` filter:

In `features/follow-ups/queries.ts`, change `getFollowUpAlerts` signature to:

```typescript
export async function getFollowUpAlerts(
  tenantId: string,
  ownerId?: string,
  opts: { from?: Date; to?: Date } = {}
) {
  // ... existing code
  const dealFilter = {
    ...(ownerId ? { ownerId } : {}),
    isArchived: false,
    ...(opts.from || opts.to
      ? {
          createdAt: {
            ...(opts.from ? { gte: opts.from } : {}),
            ...(opts.to ? { lte: opts.to } : {}),
          },
        }
      : {}),
  }
  // rest stays the same
}
```

Then in `alerts/page.tsx`, extract `from`/`to` from `searchParams` and pass them:

```typescript
const from = searchParams.from ? new Date(searchParams.from as string) : undefined
const to = searchParams.to ? new Date(searchParams.to as string) : undefined
// ...
const [alerts, members, followUpReasons] = await Promise.all([
  getFollowUpAlerts(tenantId, ownerId, { from, to }),
  // ...
])
```

- [ ] **Step 3: Final type-check**

```bash
pnpm type-check 2>&1
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/app/\[tenantSlug\]/stats/productos/ app/app/\[tenantSlug\]/stats/alerts/page.tsx features/follow-ups/queries.ts
git commit -m "feat(T8.2,T8.3): add Productos page, apply date range to Alertas tab"
```

---

## Verification

### Integration tests
```bash
pnpm test:integration 2>&1 | tail -15
```
Expected: all tests in `stats-queries.test.ts` pass.

### Unit/type check
```bash
pnpm test && pnpm type-check
```
Expected: 0 failures, 0 type errors.

### Manual smoke test
1. Start dev server: `pnpm dev`
2. Navigate to `/app/<slug>/stats` → should redirect to `/stats/resumen`
3. Header nav now shows "Estadísticas" instead of "Alertas"
4. Tab nav: Resumen | Listado | Embudo | Equipo | Canal | Productos | Alertas
5. Click "Mes" preset → URL updates with `from`/`to`, KPI cards change
6. Switch to Embudo tab → URL `from`/`to` preserved, bar charts show stage distribution
7. Switch to Equipo → pie chart + table with per-owner data
8. Switch to Canal → same pattern
9. Switch to Productos → bar chart + demand/sold table
10. Switch to Alertas → existing alerts view, still works
11. Enter custom date range via date inputs → data updates

### Build check
```bash
pnpm build 2>&1 | tail -20
```
Expected: build completes with no errors.

---

## Mark M8 complete in backlog

After all tasks pass:
```bash
# In IMPLEMENTATION_BACKLOG.md, change M8 tasks from [ ] to [x]
git add IMPLEMENTATION_BACKLOG.md
git commit -m "chore: mark M8 (T8.1, T8.2, T8.3) as complete in backlog"
```
