"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Briefcase, Users } from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { globalSearchAction } from "@/features/search/actions"
import type { SearchResult } from "@/features/search/actions"

interface CommandMenuProps {
  tenantId: string
  tenantSlug: string
}

export function CommandMenu({ tenantId, tenantSlug }: CommandMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  // Cmd-K / Ctrl-K listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  // Debounced search
  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([])
        return
      }
      setLoading(true)
      const res = await globalSearchAction(tenantId, q)
      setLoading(false)
      if (res.ok) setResults(res.results ?? [])
    },
    [tenantId],
  )

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 300)
    return () => clearTimeout(t)
  }, [query, runSearch])

  function handleSelect(result: SearchResult) {
    setOpen(false)
    setQuery("")
    setResults([])
    if (result.type === "deal") {
      router.push(`/app/${tenantSlug}/pipeline?deal=${result.id}`)
    } else {
      router.push(`/app/${tenantSlug}/clients?client=${result.id}`)
    }
  }

  const deals = results.filter((r) => r.type === "deal")
  const clients = results.filter((r) => r.type === "client")

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar oportunidades, clientes..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!loading && query.trim() && results.length === 0 && (
          <CommandEmpty>Sin resultados para &ldquo;{query}&rdquo;</CommandEmpty>
        )}
        {loading && (
          <div className="py-6 text-center text-sm text-muted-foreground">Buscando...</div>
        )}
        {deals.length > 0 && (
          <CommandGroup heading="Oportunidades">
            {deals.map((r) => (
              <CommandItem key={r.id} onSelect={() => handleSelect(r)}>
                <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{r.title}</span>
                {r.subtitle && (
                  <span className="ml-2 text-xs text-muted-foreground truncate">{r.subtitle}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {deals.length > 0 && clients.length > 0 && <CommandSeparator />}
        {clients.length > 0 && (
          <CommandGroup heading="Clientes">
            {clients.map((r) => (
              <CommandItem key={r.id} onSelect={() => handleSelect(r)}>
                <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{r.title}</span>
                {r.subtitle && (
                  <span className="ml-2 text-xs text-muted-foreground truncate">{r.subtitle}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
