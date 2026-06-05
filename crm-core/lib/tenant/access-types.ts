export type AccessDenialReason =
  | "no_membership"
  | "membership_inactive"
  | "tenant_subscription_inactive"

export type UserAppDestination =
  | { kind: "embudo"; slug: string }
  | { kind: "access"; reason: AccessDenialReason }

export type TenantEmbudoAccess =
  | { allowed: true }
  | { allowed: false; reason: AccessDenialReason }

export type MembershipStatus = "ACTIVE" | "INACTIVE"
