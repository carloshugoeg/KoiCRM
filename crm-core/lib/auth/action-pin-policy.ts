/**
 * Whether a deal write must collect a PIN before proceeding.
 *
 * - PIN feature off (tenant + session lock): never.
 * - Session PIN lock on ("modo PIN"): always.
 * - Otherwise: only when the deal belongs to someone other than the logged-in user.
 */
export function isPinRequiredForDealAction(params: {
  pinEnabled: boolean
  sessionLocked: boolean
  sessionUserId: string
  dealOwnerId: string | null | undefined
}): boolean {
  const { pinEnabled, sessionLocked, sessionUserId, dealOwnerId } = params
  if (!pinEnabled && !sessionLocked) return false
  if (sessionLocked) return true
  if (!dealOwnerId) return true
  return dealOwnerId !== sessionUserId
}
