/** Formats phone as XXXX-XXXX or WhatsApp as +502 XXXX-XXXX (demo parity). */
export function formatPhone(raw: string, whatsapp: boolean): string {
  const digits = raw.replace(/\D/g, "")
  if (whatsapp) {
    let d = digits
    if (d.startsWith("502")) d = d.slice(3)
    if (d.length <= 4) return d ? `+502 ${d}` : "+502 "
    return `+502 ${d.slice(0, 4)}-${d.slice(4, 8)}`
  }
  if (digits.length <= 4) return digits
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}`
}
