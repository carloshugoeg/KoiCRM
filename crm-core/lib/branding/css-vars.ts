import { hexToHslComponents, isValidHexColor, primaryForegroundForHex } from "@/lib/utils/color"

/**
 * Makes a stored background URL safe to interpolate into a CSS `url("…")` inside a
 * <style> block rendered via dangerouslySetInnerHTML.
 *
 * Escaping quotes alone is not enough: a stored value containing `</style>` closes the
 * element and turns anything after it into live DOM (stored XSS). URL serialization
 * percent-encodes `<`, `>` and `"` in the path, query and fragment, so returning
 * `parsed.href` structurally removes every breakout character. Non-http(s) schemes are
 * rejected outright.
 */
export function safeCssBackgroundUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    return null
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
  return parsed.href
}

export function buildCssVars(branding: {
  primaryColor?: string | null
  bgColorLight?: string | null
  bgColorDark?: string | null
  bgImageUrl?: string | null
  headerBgColor?: string | null
  kpiBgColor?: string | null
} | null): string {
  if (!branding) return ""

  const root: string[] = []
  const dark: string[] = []

  if (isValidHexColor(branding.primaryColor)) {
    root.push(`--color-primary: ${hexToHslComponents(branding.primaryColor)};`)
    root.push(`--primary-foreground: ${primaryForegroundForHex(branding.primaryColor)};`)
  }
  if (isValidHexColor(branding.bgColorLight)) {
    root.push(`--color-bg-light: ${hexToHslComponents(branding.bgColorLight)};`)
    const c = branding.bgColorLight
    root.push(`--app-bg: linear-gradient(160deg, ${c} 0%, ${c}ee 60%, ${c} 100%);`)
  }
  if (isValidHexColor(branding.bgColorDark)) {
    dark.push(`--color-bg-dark: ${hexToHslComponents(branding.bgColorDark)};`)
    const c = branding.bgColorDark
    dark.push(`--app-bg: linear-gradient(160deg, ${c} 0%, ${c}ee 60%, ${c} 100%);`)
  }
  if (isValidHexColor(branding.headerBgColor)) {
    root.push(`--color-header-bg: ${hexToHslComponents(branding.headerBgColor)};`)
  }
  if (isValidHexColor(branding.kpiBgColor)) {
    root.push(`--color-kpi-bg: ${hexToHslComponents(branding.kpiBgColor)};`)
  }
  const safeBgImageUrl = safeCssBackgroundUrl(branding.bgImageUrl)
  if (safeBgImageUrl) {
    const bg = `url("${safeBgImageUrl}") center/cover fixed`
    root.push(`--app-bg: ${bg};`)
    dark.push(`--app-bg: ${bg};`)
  }

  const blocks: string[] = []
  if (root.length) blocks.push(`:root { ${root.join(" ")} }`)
  if (dark.length) blocks.push(`.dark { ${dark.join(" ")} }`)
  return blocks.join("\n")
}
