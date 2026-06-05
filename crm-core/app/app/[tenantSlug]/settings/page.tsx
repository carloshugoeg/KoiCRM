import { redirect } from "next/navigation"

export default function SettingsRootPage({ params }: { params: { tenantSlug: string } }) {
  redirect(`/app/${params.tenantSlug}/settings/appearance`)
}
