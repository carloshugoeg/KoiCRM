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
}

export function ClientSidebar({ tenantSlug, clients, selectedClientId }: ClientSidebarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("q") ?? "")
  const [sort, setSort] = useState<"name" | "recent">((searchParams.get("sort") as "name" | "recent") ?? "name")

  const pushParams = useCallback(
    (nextSearch: string, nextSort: "name" | "recent") => {
      const params = new URLSearchParams()
      if (nextSearch) params.set("q", nextSearch)
      if (nextSort !== "name") params.set("sort", nextSort)
      router.replace(`/app/${tenantSlug}/clients?${params.toString()}`)
    },
    [router, tenantSlug],
  )

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => pushParams(search, sort), 300)
    return () => clearTimeout(t)
  }, [search, sort, pushParams])

  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("")

  return (
    <aside className="w-72 shrink-0 border-r flex flex-col h-full">
      {/* Search + sort */}
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            className="pl-8 h-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={sort === "name" ? "default" : "outline"}
            className="h-7 text-xs flex-1"
            onClick={() => setSort("name")}
          >
            A–Z
          </Button>
          <Button
            size="sm"
            variant={sort === "recent" ? "default" : "outline"}
            className="h-7 text-xs flex-1"
            onClick={() => setSort("recent")}
          >
            Reciente
          </Button>
        </div>
      </div>

      {/* Jump nav */}
      {sort === "name" && (
        <div className="px-3 pt-2 flex flex-wrap gap-0.5">
          {alpha.map((letter) => (
            <button
              key={letter}
              className="text-xs text-muted-foreground hover:text-primary w-5 h-5 flex items-center justify-center"
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
          <p className="text-xs text-muted-foreground p-4 text-center">Sin clientes.</p>
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
                  className="px-3 py-1 text-xs font-bold text-muted-foreground bg-muted/40 sticky top-0"
                >
                  {/[A-Z]/.test(thisLetter) ? thisLetter : "#"}
                </div>
              )}
              <button
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors ${isSelected ? "bg-muted" : ""}`}
                onClick={() =>
                  router.push(`/app/${tenantSlug}/clients?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), client: client.id }).toString()}`)
                }
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {avatarInitials(client.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{client.name}</p>
                  {client.company && (
                    <p className="text-xs text-muted-foreground truncate">{client.company}</p>
                  )}
                </div>
                {client._count.deals > 0 && (
                  <span className="text-xs text-muted-foreground shrink-0">{client._count.deals}</span>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
