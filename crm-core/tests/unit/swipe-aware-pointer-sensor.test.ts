import { describe, it, expect, vi, afterEach } from "vitest"
import { PointerSensor } from "@dnd-kit/core"
import { SwipeAwarePointerSensor } from "@/features/pipeline/sensors/swipe-aware-pointer-sensor"

/**
 * The kanban hands DndContext one sensor list whose size never changes, and refuses the
 * drag inside the sensor instead. Handing it a shorter list on phones is what produced
 * "the final argument passed to useEffect changed size between renders" in the console.
 */

const activator = SwipeAwarePointerSensor.activators[0]

function setViewport(narrow: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: narrow && query === "(max-width: 767px)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function pointerDown(overrides: Partial<PointerEvent> = {}) {
  return {
    nativeEvent: { isPrimary: true, button: 0, ...overrides },
  } as unknown as Parameters<typeof activator.handler>[0]
}

function options(onActivation?: () => void) {
  return { onActivation } as unknown as Parameters<typeof activator.handler>[1]
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("SwipeAwarePointerSensor", () => {
  it("listens on the same event as the sensor it replaces", () => {
    expect(activator.eventName).toBe(PointerSensor.activators[0].eventName)
  })

  it("exposes exactly one activator, so the sensor list size is fixed", () => {
    expect(SwipeAwarePointerSensor.activators).toHaveLength(1)
    expect(PointerSensor.activators).toHaveLength(1)
  })

  it("refuses to start a drag on a phone-sized viewport", () => {
    setViewport(true)
    const onActivation = vi.fn()
    expect(activator.handler(pointerDown(), options(onActivation))).toBe(false)
    expect(onActivation).not.toHaveBeenCalled()
  })

  it("starts a drag above the breakpoint", () => {
    setViewport(false)
    expect(activator.handler(pointerDown(), options())).toBe(true)
  })

  it("still fires dnd-kit's onActivation when it does start", () => {
    setViewport(false)
    const onActivation = vi.fn()
    activator.handler(pointerDown(), options(onActivation))
    expect(onActivation).toHaveBeenCalledTimes(1)
  })

  it("keeps dnd-kit's primary-button guard rather than replacing it", () => {
    setViewport(false)
    expect(activator.handler(pointerDown({ button: 2 } as Partial<PointerEvent>), options())).toBe(false)
    expect(activator.handler(pointerDown({ isPrimary: false } as Partial<PointerEvent>), options())).toBe(false)
  })

  it("treats an environment without matchMedia as wide, not narrow", () => {
    vi.stubGlobal("matchMedia", undefined)
    expect(activator.handler(pointerDown(), options())).toBe(true)
  })
})
