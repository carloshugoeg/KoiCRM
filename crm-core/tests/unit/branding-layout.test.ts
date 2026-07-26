import { describe, it, expect } from "vitest"
import { buildCssVars, safeCssBackgroundUrl } from "@/lib/branding/css-vars"
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

describe("bgImageUrl injection guard", () => {
  // buildCssVars output is rendered with dangerouslySetInnerHTML inside a <style> element,
  // so a stored value must never be able to emit a literal `</style>` and break out.
  const breakout = 'https://x.com/#}</style><script>alert(document.cookie)</script>'

  it("never emits a style-element breakout for a crafted url", () => {
    const result = buildCssVars({ bgImageUrl: breakout })
    expect(result).not.toContain("</style>")
    expect(result).not.toContain("<script>")
    expect(result).toContain("--app-bg: url(")
  })

  it("rejects non-http(s) schemes", () => {
    expect(safeCssBackgroundUrl("javascript:alert(1)")).toBeNull()
    expect(safeCssBackgroundUrl("data:text/html,<script>alert(1)</script>")).toBeNull()
    expect(buildCssVars({ bgImageUrl: "javascript:alert(1)" })).toBe("")
  })

  it("rejects values that are not URLs at all", () => {
    expect(safeCssBackgroundUrl('") ; } body { display: none } .x { --a: url("')).toBeNull()
    expect(safeCssBackgroundUrl("")).toBeNull()
    expect(safeCssBackgroundUrl(null)).toBeNull()
  })

  it("preserves a legitimate image url unchanged", () => {
    const url = "https://cdn.example.com/bg-1.png?v=2"
    expect(safeCssBackgroundUrl(url)).toBe(url)
    expect(buildCssVars({ bgImageUrl: url })).toContain(`url("${url}")`)
  })

  it("applies the background to both :root and .dark", () => {
    const result = buildCssVars({ bgImageUrl: "https://cdn.example.com/bg.png" })
    expect(result).toContain(":root {")
    expect(result).toContain(".dark {")
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
