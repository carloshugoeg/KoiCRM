import { describe, it, expect } from "vitest"
import { buildCssVars } from "@/lib/branding/css-vars"
import { hexToHslComponents, primaryForegroundForHex } from "@/lib/utils/color"

describe("buildCssVars CSS injection guard", () => {
  it("converts a valid hex primary color to HSL components", () => {
    const result = buildCssVars({ primaryColor: "#ff0000" })
    expect(result).toContain(`--color-primary: ${hexToHslComponents("#ff0000")};`)
    expect(result).toContain(`--primary-foreground: ${primaryForegroundForHex("#ff0000")};`)
  })
  it("strips malicious CSS injection", () => {
    const result = buildCssVars({ primaryColor: "red; } body { visibility: hidden; } .x { --a: b" })
    expect(result).not.toContain("visibility")
    expect(result).toBe("")
  })
  it("handles null branding gracefully", () => {
    expect(buildCssVars(null)).toBe("")
  })
  it("only includes fields with valid hex colors", () => {
    const result = buildCssVars({ primaryColor: "#abc123", bgColorLight: "invalid" })
    expect(result).toContain("--color-primary")
    expect(result).not.toContain("--color-bg-light")
  })
  it("valid 6-char hex with uppercase letters passes", () => {
    const result = buildCssVars({ primaryColor: "#AABBCC" })
    expect(result).toContain(`--color-primary: ${hexToHslComponents("#AABBCC")};`)
  })
})

describe("hexToHslComponents", () => {
  it("converts known hex values", () => {
    expect(hexToHslComponents("#0ea5e9")).toBe("199 89% 48%")
  })
})

describe("primaryForegroundForHex", () => {
  it("uses dark text on light backgrounds", () => {
    expect(primaryForegroundForHex("#ffffff")).toContain("11.2%")
  })
  it("uses light text on dark backgrounds", () => {
    expect(primaryForegroundForHex("#000000")).toContain("98%")
  })
})
