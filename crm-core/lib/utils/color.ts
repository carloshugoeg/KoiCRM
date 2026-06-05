const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

export function hex2rgba(hex: string, alpha = 0.15): string {
  let h = hex.replace("#", "")
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${Number.isNaN(r) ? 0 : r},${Number.isNaN(g) ? 0 : g},${Number.isNaN(b) ? 0 : b},${alpha})`
}

export function isValidHexColor(value: string | null | undefined): value is string {
  return value != null && HEX_COLOR_RE.test(value)
}

/** Converts #RRGGBB to "H S% L%" for use inside hsl(var(--token)). */
export function hexToHslComponents(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) * 60
        break
      case g:
        h = ((b - r) / delta + 2) * 60
        break
      default:
        h = ((r - g) / delta + 4) * 60
        break
    }
  }

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/** Picks light or dark foreground for readable contrast on a hex background. */
export function primaryForegroundForHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? "222.2 47.4% 11.2%" : "210 40% 98%"
}
