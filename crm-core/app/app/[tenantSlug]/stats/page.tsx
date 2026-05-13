import { redirect } from "next/navigation"

export default function StatsPage({ params }: { params: { tenantSlug: string } }) {
  redirect(`/app/${params.tenantSlug}/stats/resumen`)
}
