"use client"

import { createContext, useContext, createElement } from "react"
import type { ReactNode } from "react"
import type { Membership, Tenant, TenantBranding } from "@prisma/client"

export type TenantContextValue = {
  tenant: Tenant & { branding: TenantBranding | null }
  membership: Membership
}

const TenantContext = createContext<TenantContextValue | null>(null)

export function TenantProvider({ value, children }: { value: TenantContextValue; children: ReactNode }) {
  return createElement(TenantContext.Provider, { value }, children)
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error("useTenant must be used inside TenantProvider")
  return ctx
}
