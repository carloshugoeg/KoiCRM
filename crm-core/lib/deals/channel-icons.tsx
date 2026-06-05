import {
  Store,
  Phone,
  Smartphone,
  Share2,
  Camera,
  Hash,
  type LucideIcon,
} from "lucide-react"

const CHANNEL_ICON_MAP: Record<string, LucideIcon> = {
  sala: Store,
  telefono: Phone,
  whatsapp: Smartphone,
  facebook: Share2,
  instagram: Camera,
}

const DEFAULT_CHANNEL_COLOR = "#818cf8"

export function getChannelIcon(key: string): LucideIcon {
  return CHANNEL_ICON_MAP[key] ?? Hash
}

export function getChannelColor(color: string | null | undefined): string {
  return color ?? DEFAULT_CHANNEL_COLOR
}
