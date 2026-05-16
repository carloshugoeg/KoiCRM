import { describe, it, expect } from "vitest"

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

function buildCssVars(branding: {
  primaryColor?: string | null
  bgColorLight?: string | null
  bgColorDark?: string | null
  headerBgColor?: string | null
  kpiBgColor?: string | null
} | null): string {
  if (!branding) return ""
  const valid = (v: string | null | undefined): v is string => v != null && HEX_COLOR_RE.test(v)
  const vars: string[] = []
  if (valid(branding.primaryColor)) vars.push(`--color-primary: ${branding.primaryColor};`)
  if (valid(branding.bgColorLight)) vars.push(`--color-bg-light: ${branding.bgColorLight};`)
  if (valid(branding.bgColorDark)) vars.push(`--color-bg-dark: ${branding.bgColorDark};`)
  if (valid(branding.headerBgColor)) vars.push(`--color-header-bg: ${branding.headerBgColor};`)
  if (valid(branding.kpiBgColor)) vars.push(`--color-kpi-bg: ${branding.kpiBgColor};`)
  return vars.length ? `:root { ${vars.join(" ")} }` : ""
}

describe("buildCssVars CSS injection guard", () => {
  it("injects a valid hex color", () => {
    const result = buildCssVars({ primaryColor: "#ff0000" })
    expect(result).toContain("--color-primary: #ff0000;")
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
    expect(result).toContain("--color-primary: #AABBCC;")
  })
})
