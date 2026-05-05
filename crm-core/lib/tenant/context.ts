"use client"

import { createContext, useContext } from "react"
import type { Membership, Tenant, TenantBranding } from "@prisma/client"

export type TenantContextValue = {
  tenant: Tenant & { branding: TenantBranding | null }
  membership: Membership
}

const TenantContext = createContext<TenantContextValue | null>(null)
export const TenantProvider = TenantContext.Provider

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error("useTenant must be used inside TenantProvider")
  return ctx
}
