import { describe, it, expect } from "vitest"
import { Sun, Zap, Star } from "lucide-react"
import { equipmentIcon } from "@/lib/settings/constants"

describe("equipmentIcon", () => {
  it("prefers the longest matching prefix over a shorter one", () => {
    // "Calentador" also prefixes this label; the specific entry has to win.
    expect(equipmentIcon("Calentadores solares 150L")).toBe(Sun)
  })

  it("still resolves the shorter prefix on its own", () => {
    expect(equipmentIcon("Calentador de paso")).toBe(Zap)
  })

  it("matches case-insensitively", () => {
    expect(equipmentIcon("CALENTADORES SOLARES 200L")).toBe(Sun)
  })

  it("falls back to a star for an unknown label", () => {
    expect(equipmentIcon("Artículo sin categoría")).toBe(Star)
  })

  it("falls back for an empty label", () => {
    expect(equipmentIcon("")).toBe(Star)
  })
})
