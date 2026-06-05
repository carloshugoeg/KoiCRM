import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveSessionUserId } from "@/lib/tenant/bootstrap"
import { resolveUserAppDestination } from "@/lib/tenant/access"

export default async function AppRootPage() {
  const session = await auth()
  if (!session?.user) redirect("/signin")

  const userId = await resolveSessionUserId(session)
  if (!userId) redirect("/signin")

  const destination = await resolveUserAppDestination(userId)
  if (destination.kind === "embudo") {
    redirect(`/app/${destination.slug}/pipeline`)
  }

  redirect(`/app/access?reason=${destination.reason}`)
}
