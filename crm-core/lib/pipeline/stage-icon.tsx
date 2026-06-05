import {
  Star,
  User,
  Phone,
  DollarSign,
  Flame,
  CheckCircle2,
  Clock,
  Zap,
  Package,
  Waves,
  type LucideIcon,
} from "lucide-react"

const STAGE_ICON_MAP: Record<string, LucideIcon> = {
  Star,
  User,
  Phone,
  DollarSign,
  Flame,
  CheckCircle2,
  Clock,
  Zap,
  Package,
  Waves,
}

export function getStageIcon(iconKey: string): LucideIcon {
  return STAGE_ICON_MAP[iconKey] ?? Star
}
