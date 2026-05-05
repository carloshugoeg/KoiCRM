import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/client"

export default async function AppRootPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { tenant: { select: { slug: true } } },
    orderBy: { createdAt: "asc" },
  })

  if (!membership) redirect("/app/onboarding")
  redirect(`/app/${membership.tenant.slug}/pipeline`)
}
