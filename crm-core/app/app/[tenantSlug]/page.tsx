import { redirect } from "next/navigation"

export default function TenantRootPage({ params }: { params: { tenantSlug: string } }) {
  redirect(`/app/${params.tenantSlug}/pipeline`)
}
