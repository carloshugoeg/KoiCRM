import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { listIndustries } from "@/lib/industry/registry"
import { resolveSessionUserId } from "@/lib/tenant/bootstrap"
import { resolveUserAppDestination } from "@/lib/tenant/access"
import { OnboardingForm } from "./onboarding-form"

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user) redirect("/signin")

  const userId = await resolveSessionUserId(session)
  if (!userId) redirect("/signin")

  const destination = await resolveUserAppDestination(userId)
  if (destination.kind === "embudo") {
    redirect(`/app/${destination.slug}/pipeline`)
  }
  if (destination.kind === "access") {
    redirect(`/app/access?reason=${destination.reason}`)
  }

  const industries = listIndustries()
  const defaultIndustrySlug = industries[0]?.slug ?? "generic"

  return <OnboardingForm industries={industries} defaultIndustrySlug={defaultIndustrySlug} />
}
