type IntlSettings = {
  locale: string
  currency: string
  timezone?: string
}

export function formatCurrency(amount: number, settings: IntlSettings): string {
  return new Intl.NumberFormat(settings.locale, {
    style: "currency",
    currency: settings.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: Date | string, settings: Pick<IntlSettings, "locale" | "timezone">): string {
  return new Intl.DateTimeFormat(settings.locale, {
    timeZone: settings.timezone ?? "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string, settings: IntlSettings): string {
  return new Intl.DateTimeFormat(settings.locale, {
    timeZone: settings.timezone ?? "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}
