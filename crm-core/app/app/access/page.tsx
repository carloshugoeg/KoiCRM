import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveSessionUserId } from "@/lib/tenant/bootstrap"
import {
  accessDenialCopy,
  membershipContactInfo,
  resolveUserAppDestination,
  type AccessDenialReason,
} from "@/lib/tenant/access"
import { MembershipAccessPanel } from "./membership-access-panel"

const REASONS: AccessDenialReason[] = [
  "no_membership",
  "membership_inactive",
  "tenant_subscription_inactive",
]

type Props = {
  searchParams: { reason?: string }
}

export default async function MembershipAccessPage({ searchParams }: Props) {
  const session = await auth()
  if (!session?.user) redirect("/signin")

  const userId = await resolveSessionUserId(session)
  if (!userId) redirect("/signin")

  const destination = await resolveUserAppDestination(userId)
  if (destination.kind === "embudo") {
    redirect(`/app/${destination.slug}/pipeline`)
  }

  const reasonParam = searchParams.reason
  const reason: AccessDenialReason =
    reasonParam && REASONS.includes(reasonParam as AccessDenialReason)
      ? (reasonParam as AccessDenialReason)
      : destination.reason

  const copy = accessDenialCopy(reason)
  const contact = membershipContactInfo()

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-12">
      <div className="mb-8 space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">{copy.title}</h1>
        <p className="text-sm text-slate-600">{copy.body}</p>
      </div>

      <MembershipAccessPanel
        contactEmail={contact.email}
        contactPhone={contact.phone}
        contactLabel={contact.label}
      />

      <p className="mt-8 text-center text-xs text-slate-400">
        <Link href="/signin" className="underline">
          Cerrar sesión e intentar con otra cuenta
        </Link>
      </p>
    </div>
  )
}
