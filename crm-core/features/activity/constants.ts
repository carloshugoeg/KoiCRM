import type { ActivityType } from "./queries"

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  created: "Oportunidad creada",
  stageChanged: "Etapa cambiada",
  ownerChanged: "Asesor cambiado",
  valueChanged: "Valor actualizado",
  quoteAdded: "Cotización agregada",
  paymentAdded: "Pago agregado",
  archived: "Archivado",
  followUpAdded: "Seguimiento programado",
  followUpCompleted: "Seguimiento completado",
  noteAdded: "Nota agregada",
}
