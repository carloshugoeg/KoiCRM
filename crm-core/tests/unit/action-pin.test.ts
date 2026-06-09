import { describe, it, expect } from "vitest"
import { isPinRequiredForDealAction } from "@/lib/auth/action-pin-policy"

const ME = "user-me"
const OTHER = "user-other"

describe("isPinRequiredForDealAction", () => {
  it("never requires PIN when tenant PIN and session lock are both off", () => {
    expect(
      isPinRequiredForDealAction({
        pinEnabled: false,
        sessionLocked: false,
        sessionUserId: ME,
        dealOwnerId: OTHER,
      }),
    ).toBe(false)
  })

  it("always requires PIN when session PIN lock is on", () => {
    expect(
      isPinRequiredForDealAction({
        pinEnabled: false,
        sessionLocked: true,
        sessionUserId: ME,
        dealOwnerId: ME,
      }),
    ).toBe(true)
  })

  it("skips PIN for own leads when workspace PIN is on and session lock is off", () => {
    expect(
      isPinRequiredForDealAction({
        pinEnabled: true,
        sessionLocked: false,
        sessionUserId: ME,
        dealOwnerId: ME,
      }),
    ).toBe(false)
  })

  it("requires PIN for other people's leads when workspace PIN is on and session lock is off", () => {
    expect(
      isPinRequiredForDealAction({
        pinEnabled: true,
        sessionLocked: false,
        sessionUserId: ME,
        dealOwnerId: OTHER,
      }),
    ).toBe(true)
  })

  it("requires PIN when ownership is unknown and workspace PIN is on", () => {
    expect(
      isPinRequiredForDealAction({
        pinEnabled: true,
        sessionLocked: false,
        sessionUserId: ME,
        dealOwnerId: null,
      }),
    ).toBe(true)
  })
})
