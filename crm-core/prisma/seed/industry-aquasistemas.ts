export { applyIndustryTemplate } from "@/lib/industry/registry"
export { getIndustry as getAquasistemasConfig } from "@/lib/industry/registry"

import { getIndustry } from "@/lib/industry/registry"
export const AQUASISTEMAS_CONFIG = getIndustry("aquasistemas")!
