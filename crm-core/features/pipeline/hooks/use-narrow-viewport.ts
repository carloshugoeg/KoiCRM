"use client"

import { useSyncExternalStore } from "react"

/**
 * Same breakpoint as the funnel's `board` tier (tailwind.config.ts): below it, the whole
 * board doesn't fit on screen at once (phone's one-stage carousel, tablet-portrait's
 * two-stage carousel), so the horizontal swipe gesture owns the touch instead of dnd-kit.
 */
const NARROW_QUERY = "(max-width: 1023px)"

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
 * True below the board tier (phone and tablet-portrait). Used to turn drag-and-drop off
 * so the horizontal swipe gesture owns the touch interaction; layout itself stays
 * CSS-driven.
 */
export function useNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
