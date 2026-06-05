import { hexToHslComponents, isValidHexColor, primaryForegroundForHex } from "@/lib/utils/color"

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
  if (branding.bgImageUrl) {
    const safe = branding.bgImageUrl.replace(/"/g, "%22")
    const bg = `url("${safe}") center/cover fixed`
    root.push(`--app-bg: ${bg};`)
    dark.push(`--app-bg: ${bg};`)
  }

  const blocks: string[] = []
  if (root.length) blocks.push(`:root { ${root.join(" ")} }`)
  if (dark.length) blocks.push(`.dark { ${dark.join(" ")} }`)
  return blocks.join("\n")
}
