"use server"

import { auth } from "@/lib/auth/auth"
import { resolveSessionUserId } from "@/lib/tenant/bootstrap"
import { resolvePostLoginPath } from "@/lib/tenant/access"

export async function resolvePostLoginPathAction(
  callbackUrl: string | null | undefined,
): Promise<string> {
  const session = await auth()
  if (!session?.user) return "/signin"

  const userId = await resolveSessionUserId(session)
  if (!userId) return "/signin"

  return resolvePostLoginPath(userId, callbackUrl)
}
