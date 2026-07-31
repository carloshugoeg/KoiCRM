import { PointerSensor } from "@dnd-kit/core"
import { isNarrowViewport } from "@/features/pipeline/hooks/use-narrow-viewport"

/**
 * PointerSensor that declines to start a drag on phone-sized viewports, leaving the
 * horizontal swipe between stages in sole possession of the touch.
 *
 * Refusing inside the sensor is what keeps the sensor list a fixed size across renders.
 * The obvious alternative — handing DndContext a shorter list when the viewport is narrow —
 * changes the size of the dependency array dnd-kit derives from it, which React rejects
 * outright. And the swap really would happen on every session: useNarrowViewport renders
 * false on the server and the real value after hydration, then again on every rotation
 * across the breakpoint.
 */
export class SwipeAwarePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      // Delegates to dnd-kit's own handler once past the viewport check, so the
      // primary-button guard and the onActivation callback it fires keep working.
      handler: ((event, options) => {
        if (isNarrowViewport()) return false
        return PointerSensor.activators[0].handler(event, options)
      }) as (typeof PointerSensor.activators)[0]["handler"],
    },
  ]
}
