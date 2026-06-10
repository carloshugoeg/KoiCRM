import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getFollowUpAlerts, type FollowUpAlert } from "@/features/follow-ups/queries"
import { parseDate } from "@/lib/intl/format"
import { getTenantMembers } from "@/features/tenants/queries"
import { Badge } from "@/components/ui/badge"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

function AlertRow({ fu }: { fu: FollowUpAlert }) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fu.deal.name}</p>
        {fu.deal.company && <p className="text-xs text-muted-foreground">{fu.deal.company}</p>}
        {fu.note && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{fu.note}</p>}
      </div>
      <Badge variant="secondary" className="text-xs shrink-0">{fu.deal.stage.label}</Badge>
      <span className="text-xs text-muted-foreground shrink-0">
        {new Date(fu.date).toLocaleDateString("es-GT")}
      </span>
    </div>
  )
}

function AlertSection({
  title, count, items, emptyText, countClass,
}: {
  title: string; count: number; items: FollowUpAlert[]
  emptyText: string; countClass: string
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${countClass}`}>{count}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((fu) => (
            <AlertRow key={fu.id} fu={fu} />
          ))}
        </div>
      )}
    </div>
  )
}

export default async function AlertsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const tenantId = tenant.id
  const ownerId = searchParams.owner as string | undefined
  const from = parseDate(searchParams.from)
  const to = parseDate(searchParams.to)

  const [alerts, members] = await Promise.all([
    getFollowUpAlerts(tenantId, ownerId, { from, to }),
    getTenantMembers(tenantId),
  ])

  const memberList = members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email }))

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold">Alertas de seguimiento</h1>
          <p className="text-sm text-muted-foreground">Seguimientos vencidos, para hoy y próximos 7 días</p>
        </div>
        <form action={`/app/${params.tenantSlug}/stats/alerts`} method="GET" className="flex gap-2 items-center">
          {searchParams.from && <input type="hidden" name="from" value={searchParams.from as string} />}
          {searchParams.to && <input type="hidden" name="to" value={searchParams.to as string} />}
          <select name="owner" defaultValue={ownerId ?? ""} className="h-8 rounded border text-xs px-2 bg-background">
            <option value="">Todos los asesores</option>
            {memberList.map((m) => (
              <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
            ))}
          </select>
          <button type="submit" className="text-xs border rounded px-2 py-1 hover:bg-muted transition-colors">
            Filtrar
          </button>
        </form>
      </div>
      <div className="space-y-8">
        <AlertSection title="Vencidos" count={alerts.overdue.length} items={alerts.overdue}
          emptyText="No hay seguimientos vencidos." countClass="bg-red-100 text-red-700" />
        <AlertSection title="Para hoy" count={alerts.today.length} items={alerts.today}
          emptyText="No hay seguimientos programados para hoy." countClass="bg-orange-100 text-orange-700" />
        <AlertSection title="Próximos 7 días" count={alerts.next7.length} items={alerts.next7}
          emptyText="No hay seguimientos en los próximos 7 días." countClass="bg-blue-100 text-blue-700" />
      </div>
    </div>
  )
}
