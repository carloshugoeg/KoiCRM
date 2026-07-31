"use client"

import { useSyncExternalStore } from "react"

/** Same breakpoint as Tailwind's `md`: below it the funnel renders as swipeable slides. */
const NARROW_QUERY = "(max-width: 767px)"

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const mql = window.matchMedia(NARROW_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia(NARROW_QUERY).matches
}

/**
 * Imperative read of the same breakpoint, for callers that run outside React's render
 * cycle — dnd-kit sensor activators, for one. Prefer the hook anywhere a re-render is
 * wanted; this is deliberately not reactive.
 */
export function isNarrowViewport(): boolean {
  return getSnapshot()
}

function getServerSnapshot() {
  return false
}

/**
 * True on phone-sized viewports. Used to turn drag-and-drop off so the horizontal
 * swipe gesture owns the touch interaction; layout itself stays CSS-driven.
 */
export function useNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
