"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { avatarColor, avatarInitials } from "@/lib/utils/avatar-color"
import type { ClientWithDealCount } from "@/features/clients/queries"

interface ClientSidebarProps {
  tenantSlug: string
  clients: ClientWithDealCount[]
  selectedClientId?: string
  nextCursor: string | null
}

export function ClientSidebar({
  tenantSlug,
  clients,
  selectedClientId,
  nextCursor,
}: ClientSidebarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("q") ?? "")
  const [sort, setSort] = useState<"name" | "recent">(
    (searchParams.get("sort") as "name" | "recent") ?? "name"
  )

  const pushParams = useCallback(
    (nextSearch: string, nextSort: "name" | "recent") => {
      const params = new URLSearchParams()
      if (nextSearch) params.set("q", nextSearch)
      if (nextSort !== "name") params.set("sort", nextSort)
      router.replace(`/app/${tenantSlug}/clients?${params.toString()}`)
    },
    [router, tenantSlug]
  )

  function loadMore() {
    if (!nextCursor) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("cursor", nextCursor)
    router.push(`/app/${tenantSlug}/clients?${params.toString()}`)
  }

  // Debounce search/sort. Only push when the value actually changed from the URL,
  // so the mount-time run doesn't strip an active `cursor` (load-more) param.
  useEffect(() => {
    const urlSearch = searchParams.get("q") ?? ""
    const urlSort = (searchParams.get("sort") as "name" | "recent") ?? "name"
    if (search === urlSearch && sort === urlSort) return
    const t = setTimeout(() => pushParams(search, sort), 300)
    return () => clearTimeout(t)
  }, [search, sort, pushParams, searchParams])

  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("")

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r">
      {/* Search + sort */}
      <div className="space-y-2 border-b p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, empresa o teléfono..."
            className="h-8 pl-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">
            {clients.length} {clients.length === 1 ? "cliente" : "clientes"}
          </span>
          <div className="ml-auto flex gap-1">
            <Button
              size="sm"
              variant={sort === "name" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setSort("name")}
            >
              A–Z
            </Button>
            <Button
              size="sm"
              variant={sort === "recent" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setSort("recent")}
            >
              Fecha
            </Button>
          </div>
        </div>
      </div>

      {/* Jump nav */}
      {sort === "name" && (
        <div className="flex flex-wrap gap-0.5 px-3 pt-2">
          {alpha.map((letter) => (
            <button
              key={letter}
              className="flex h-5 w-5 items-center justify-center text-xs text-muted-foreground hover:text-primary"
              onClick={() => {
                const el = document.getElementById(`jump-${letter}`)
                el?.scrollIntoView({ behavior: "smooth", block: "start" })
              }}
            >
              {letter}
            </button>
          ))}
        </div>
      )}

      {/* Client list */}
      <div className="flex-1 overflow-y-auto">
        {clients.length === 0 && (
          <p className="p-4 text-center text-xs text-muted-foreground">Sin clientes.</p>
        )}
        {clients.map((client, idx) => {
          const prevLetter = idx > 0 ? clients[idx - 1]!.name[0]!.toUpperCase() : null
          const thisLetter = client.name[0]!.toUpperCase()
          const showSection = sort === "name" && thisLetter !== prevLetter
          const color = avatarColor(client.id)
          const isSelected = client.id === selectedClientId

          return (
            <div key={client.id}>
              {showSection && (
                <div
                  id={`jump-${/[A-Z]/.test(thisLetter) ? thisLetter : "#"}`}
                  className="sticky top-0 bg-muted/40 px-3 py-1 text-xs font-bold text-muted-foreground"
                >
                  {/[A-Z]/.test(thisLetter) ? thisLetter : "#"}
                </div>
              )}
              <button
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 ${isSelected ? "bg-muted" : ""}`}
                onClick={() =>
                  router.push(
                    `/app/${tenantSlug}/clients?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), client: client.id }).toString()}`
                  )
                }
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {avatarInitials(client.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{client.name}</p>
                  {client.company && (
                    <p className="truncate text-xs text-muted-foreground">{client.company}</p>
                  )}
                  {client._count.deals > 0 && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {client._count.deals}{" "}
                      {client._count.deals === 1 ? "oportunidad" : "oportunidades"}
                    </p>
                  )}
                </div>
              </button>
            </div>
          )
        })}

        {/* Load more (cursor pagination) */}
        {nextCursor && (
          <div className="p-3">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-full text-xs"
              onClick={loadMore}
            >
              Cargar más
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
