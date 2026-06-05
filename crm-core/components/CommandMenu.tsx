"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Briefcase, Users, Phone, User, FileText, Receipt } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import type { SearchResult, SearchMatchVia } from "@/features/search/actions"

const OPEN_EVENT = "koi:open-command-menu"

interface CommandMenuProps {
  tenantId: string
  tenantSlug: string
}

function resultValue(result: SearchResult): string {
  return `${result.type}:${result.id}`
}

function matchViaLabel(via: SearchMatchVia | undefined): string | null {
  switch (via) {
    case "quote":
      return "Cotización"
    case "payment":
      return "Pago"
    case "phone":
      return "Teléfono"
    case "company":
      return "Empresa"
    case "id":
      return "ID"
    default:
      return null
  }
}

function SearchResultRow({ result }: { result: SearchResult }) {
  const { meta } = result
  const viaLabel = matchViaLabel(meta.matchedVia)
  const matchedRef =
    meta.matchedVia === "quote"
      ? meta.matchedQuoteNumber
      : meta.matchedVia === "payment"
        ? meta.matchedPaymentNumber
        : null

  return (
    <div className="flex flex-1 min-w-0 flex-col gap-0.5 py-0.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium truncate">{result.title}</span>
        {result.type === "deal" && meta.stageLabel && (
          <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 h-5">
            {meta.stageLabel}
          </Badge>
        )}
        {viaLabel && (
          <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 h-5">
            {viaLabel}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        {result.subtitle && <span className="truncate max-w-[200px]">{result.subtitle}</span>}
        {meta.ownerName && (
          <span className="inline-flex items-center gap-0.5 shrink-0">
            <User className="h-3 w-3" />
            {meta.ownerName}
          </span>
        )}
        {meta.phone && (
          <span className="inline-flex items-center gap-0.5 shrink-0">
            <Phone className="h-3 w-3" />
            {meta.phone}
          </span>
        )}
        {matchedRef && (
          <span className="inline-flex items-center gap-0.5 shrink-0">
            {meta.matchedVia === "payment" ? (
              <Receipt className="h-3 w-3" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            {matchedRef}
          </span>
        )}
        {result.type === "client" && meta.dealCount != null && meta.dealCount > 0 && (
          <span className="shrink-0">{meta.dealCount} oportunidad{meta.dealCount === 1 ? "" : "es"}</span>
        )}
      </div>
      {result.type === "deal" && meta.valueFormatted && (
        <span className="text-xs font-semibold text-foreground/80">{meta.valueFormatted}</span>
      )}
    </div>
  )
}

export function CommandMenu({ tenantId, tenantSlug }: CommandMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchSeq = useRef(0)

  const resetSearch = useCallback(() => {
    setQuery("")
    setResults([])
    setLoading(false)
    setError(null)
    searchSeq.current += 1
  }, [])

  // Cmd-K / Ctrl-K and programmatic open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    function onOpenEvent() {
      setOpen(true)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener(OPEN_EVENT, onOpenEvent)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener(OPEN_EVENT, onOpenEvent)
    }
  }, [])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) resetSearch()
  }

  const runSearch = useCallback(
    async (q: string, seq: number) => {
      const trimmed = q.trim()
      if (!trimmed) {
        if (seq === searchSeq.current) {
          setResults([])
          setLoading(false)
          setError(null)
        }
        return
      }
      setLoading(true)
      setError(null)
      const res = await globalSearchAction(tenantId, trimmed)
      if (seq !== searchSeq.current) return
      setLoading(false)
      if (res.ok) {
        setResults(res.results ?? [])
        setError(null)
      } else {
        setResults([])
        setError(res.error ?? "Error al buscar.")
      }
    },
    [tenantId],
  )

  useEffect(() => {
    const seq = ++searchSeq.current
    const t = setTimeout(() => runSearch(query, seq), 280)
    return () => clearTimeout(t)
  }, [query, runSearch])

  function handleSelect(result: SearchResult) {
    setOpen(false)
    resetSearch()
    if (result.type === "deal") {
      router.push(`/app/${tenantSlug}/pipeline?deal=${encodeURIComponent(result.id)}`)
    } else {
      router.push(`/app/${tenantSlug}/clients?client=${encodeURIComponent(result.id)}`)
    }
  }

  const deals = results.filter((r) => r.type === "deal")
  const clients = results.filter((r) => r.type === "client")
  const hasQuery = query.trim().length > 0

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Buscar por nombre, empresa, teléfono, ID, cotización o pago..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!hasQuery && (
          <div className="py-8 px-4 text-center text-sm text-muted-foreground space-y-1">
            <p>Escribe para buscar en todo el CRM.</p>
            <p className="text-xs">Oportunidades, clientes, cotizaciones y pagos.</p>
          </div>
        )}
        {error && (
          <div className="py-4 px-3 text-center text-sm text-destructive">{error}</div>
        )}
        {loading && hasQuery && (
          <div className="py-6 text-center text-sm text-muted-foreground">Buscando...</div>
        )}
        {!loading && !error && hasQuery && results.length === 0 && (
          <CommandEmpty>Sin resultados para &ldquo;{query.trim()}&rdquo;</CommandEmpty>
        )}
        {!loading && deals.length > 0 && (
          <CommandGroup heading="Oportunidades">
            {deals.map((r) => (
              <CommandItem
                key={r.id}
                value={resultValue(r)}
                onSelect={() => handleSelect(r)}
                className="items-start"
              >
                <Briefcase className="mr-2 mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                <SearchResultRow result={r} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!loading && deals.length > 0 && clients.length > 0 && <CommandSeparator />}
        {!loading && clients.length > 0 && (
          <CommandGroup heading="Clientes">
            {clients.map((r) => (
              <CommandItem
                key={r.id}
                value={resultValue(r)}
                onSelect={() => handleSelect(r)}
                className="items-start"
              >
                <Users className="mr-2 mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                <SearchResultRow result={r} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}

export function openCommandMenu() {
  document.dispatchEvent(new CustomEvent(OPEN_EVENT))
}
