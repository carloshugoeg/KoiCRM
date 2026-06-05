/**
 * Copy estándar para toasts (sonner). Mantener tono breve, positivo y en español.
 */
export const toastMessages = {
  equipment: {
    added: "¡Nuevo equipo agregado!",
    removed: "¡Equipo eliminado!",
    errorAdd: "No se pudo agregar el equipo.",
    errorRemove: "No se pudo eliminar el equipo.",
  },
  leadSource: {
    added: "¡Origen de lead agregado!",
    updated: "¡Origen actualizado!",
    removed: "¡Origen eliminado!",
    orderUpdated: "¡Orden de orígenes actualizado!",
    errorAdd: "No se pudo agregar el origen.",
    errorUpdate: "No se pudo actualizar el origen.",
    errorRemove: "No se pudo eliminar el origen.",
  },
  deal: {
    created: "¡Nueva oportunidad agregada!",
    moved: "¡Oportunidad movida!",
    saved: "¡Cambios guardados!",
    archived: "¡Oportunidad archivada!",
    transferred: "¡Oportunidad cedida!",
    deleted: "¡Oportunidad eliminada!",
    errorDelete: "No se pudo eliminar la oportunidad.",
    stageUpdated: "¡Etapa actualizada!",
    followUpAdded: "¡Seguimiento agregado!",
    followUpCompleted: "¡Seguimiento completado!",
    followUpRemoved: "¡Seguimiento eliminado!",
    errorFollowUp: "No se pudo guardar el seguimiento.",
    notFound: "No se encontró la oportunidad.",
    errorCreate: "No se pudo crear la oportunidad.",
    errorSave: "No se pudieron guardar los cambios.",
    errorMove: "No se pudo mover la oportunidad.",
    errorArchive: "No se pudo archivar la oportunidad.",
    stageLocked: (stageLabel: string) =>
      `La etapa «${stageLabel}» está bloqueada. Usa el panel de detalle.`,
    paymentDocRequiredForWon:
      "Para marcar como ganado debes adjuntar un comprobante de pago (PDF o imagen) en «Documentos de Pago».",
    requiredFields: "Completa los campos requeridos.",
  },
  pipeline: {
    stageAdded: "¡Nueva etapa agregada!",
    stageRemoved: "¡Etapa eliminada!",
    stageUpdated: "¡Etapa actualizada!",
    orderUpdated: "¡Orden de etapas actualizado!",
    errorAddStage: "No se pudo agregar la etapa.",
    errorRemoveStage: "No se pudo eliminar la etapa.",
    errorUpdateStage: "No se pudo actualizar la etapa.",
  },
  catalog: {
    itemAdded: (label: string) => `¡${label} agregado al catálogo!`,
    itemRemoved: (label: string) => `¡${label} eliminado del catálogo!`,
    itemActivated: (label: string) => `¡${label} activado!`,
    itemDeactivated: (label: string) => `¡${label} desactivado!`,
    orderUpdated: "¡Orden del catálogo actualizado!",
    errorAdd: "No se pudo agregar al catálogo.",
    errorRemove: "No se pudo eliminar del catálogo.",
  },
  client: {
    saved: "¡Cliente actualizado!",
    errorSave: "No se pudo guardar el cliente.",
  },
  user: {
    joinLinkCreated: "¡Enlace de unión generado!",
    joinLinkCreatedCopied: "¡Enlace generado y copiado al portapapeles!",
    joinLinkCopied: "Enlace copiado.",
    joinLinkUpdated: "Permisos del enlace actualizados.",
    joinLinkRevoked: "Enlace revocado.",
    memberUpdated: "¡Colaborador actualizado!",
    memberRemoved: "¡Colaborador eliminado del equipo!",
    errorJoinLink: "No se pudo generar el enlace.",
    errorJoinLinkUpdate: "No se pudo actualizar el enlace.",
    errorJoinLinkRevoke: "No se pudo revocar el enlace.",
    errorUpdate: "No se pudo actualizar el colaborador.",
    errorRemove: "No se pudo eliminar el colaborador.",
  },
  branding: {
    saved: "¡Apariencia guardada!",
    errorSave: "No se pudo guardar la apariencia.",
  },
  settings: {
    saved: "¡Configuración guardada!",
    errorSave: "No se pudo guardar la configuración.",
  },
  customField: {
    added: "¡Campo personalizado agregado!",
    removed: "¡Campo eliminado!",
    errorAdd: "No se pudo agregar el campo.",
    errorRemove: "No se pudo eliminar el campo.",
  },
  note: {
    saved: "¡Nota guardada!",
    removed: "¡Nota eliminada!",
    errorSave: "No se pudo guardar la nota.",
    errorRemove: "No se pudo eliminar la nota.",
  },
  quote: {
    added: "¡Cotización agregada!",
    voided: "¡Cotización anulada!",
    removed: "¡Cotización eliminada!",
    errorSave: "No se pudo guardar la cotización.",
    errorVoid: "No se pudo anular la cotización.",
    errorRemove: "No se pudo eliminar la cotización.",
  },
  payment: {
    added: "¡Comprobante agregado!",
    voided: "¡Comprobante anulado!",
    removed: "¡Comprobante eliminado!",
    errorSave: "No se pudo guardar el comprobante.",
    errorVoid: "No se pudo anular el comprobante.",
    errorRemove: "No se pudo eliminar el comprobante.",
  },
  attachment: {
    errorConfirm: "No se pudo confirmar el archivo adjunto.",
    quoteNumberRequired: "El número de cotización es requerido.",
    paymentNumberRequired: "El número de documento es requerido.",
    fileRequired: "Adjunta un PDF o imagen.",
  },
  calendar: {
    errorOpenDeal: "No se pudo abrir la oportunidad.",
  },
} as const

/** Mensaje de error del servidor o fallback genérico. */
export function toastErrorFromResult(
  error: string | undefined,
  fallback: string,
): string {
  return error?.trim() ? error : fallback
}
