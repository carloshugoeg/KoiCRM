import type { LucideIcon } from "lucide-react"
import {
  Palette,
  Users,
  Package,
  Columns,
  Megaphone,
  Waves,
  Droplets,
  Thermometer,
  Zap,
  Wind,
  Activity,
  Star,
  ShieldCheck,
  Sun,
  ShowerHead,
  Wrench,
  Lightbulb,
} from "lucide-react"

export const PRESET_COLORS = [
  "#818cf8",
  "#38bdf8",
  "#fbbf24",
  "#f472b6",
  "#34d399",
  "#fb923c",
  "#f87171",
  "#a78bfa",
  "#4ade80",
  "#e879f9",
  "#facc15",
  "#60a5fa",
] as const

export const SETTINGS_NAV = [
  { label: "Apariencia", section: "appearance", icon: Palette },
  { label: "Usuarios", section: "users", icon: Users },
  { label: "Permisos", section: "permissions", icon: ShieldCheck },
  { label: "Equipos", section: "equipment", icon: Package },
  { label: "Origen de leads", section: "origen", icon: Megaphone },
  { label: "Embudo", section: "pipeline", icon: Columns },
] as const satisfies ReadonlyArray<{
  label: string
  section: string
  icon: LucideIcon
}>

/** Icon by equipment label prefix. Longest matching prefix wins, so a specific
 *  entry ("Calentadores solares") beats a generic one ("Calentador"). */
export const EQUIPMENT_ICONS: Record<string, LucideIcon> = {
  "Calentadores solares": Sun,
  "Calentadores eléctricos": Zap,
  "Calentador solar": Sun,
  Drenaje: ShowerHead,
  Drenajes: ShowerHead,
  Accesorios: Wrench,
  Repuesto: Wrench,
  Mantenimiento: Wrench,
  Kit: Wrench,
  Bomba: Waves,
  Jacuzzi: Droplets,
  Sauna: Thermometer,
  Calentador: Zap,
  Filtro: Wind,
  Hidrojet: Activity,
  Iluminacion: Lightbulb,
  Iluminación: Lightbulb,
  Otros: Package,
  General: Package,
}

const EQUIPMENT_ICON_KEYS = Object.keys(EQUIPMENT_ICONS).sort((a, b) => b.length - a.length)

export function equipmentIcon(label: string): LucideIcon {
  const target = label.toLowerCase()
  const match = EQUIPMENT_ICON_KEYS.find((k) => target.startsWith(k.toLowerCase()))
  return (match && EQUIPMENT_ICONS[match]) || Star
}

export function catalogKeyFromLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 50) || "item"
}
