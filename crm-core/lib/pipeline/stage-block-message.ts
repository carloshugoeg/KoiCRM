/** Mensajes cuando una etapa bloqueada impide mover una oportunidad (drag o acciones). */

export type StageBlockInput = {
  stageKey: string
  stageLabel: string
  hasPaymentWithFile?: boolean
}

export function lockedStageDropMessage(input: StageBlockInput): string {
  if (input.stageKey === "ganado") {
    if (!input.hasPaymentWithFile) {
      return "No puedes mover aquí: falta un documento de pago. Abre la oportunidad, agrega un comprobante en «Documentos de Pago» y usa «Marcar como ganado»."
    }
    return "Ganado solo se marca desde el detalle de la oportunidad (botón «Marcar como ganado»)."
  }
  if (input.stageKey === "perdido") {
    return "Perdido solo se marca desde el detalle (botón «Marcar como perdido»)."
  }
  return `La etapa «${input.stageLabel}» está bloqueada. Ábrela desde el panel de detalle.`
}

export function lockedStageColumnHint(input: StageBlockInput): string {
  if (input.stageKey === "ganado") {
    if (!input.hasPaymentWithFile) {
      return "Falta documento de pago — abre la oportunidad y adjunta un comprobante"
    }
    return "Usa «Marcar como ganado» en el detalle de la oportunidad"
  }
  if (input.stageKey === "perdido") {
    return "Usa «Marcar como perdido» en el detalle"
  }
  return "Etapa bloqueada"
}

export function lockedStageHeaderTitle(stageKey: string): string | undefined {
  if (stageKey === "ganado") {
    return "Bloqueada: requiere documento de pago para marcar como ganado"
  }
  if (stageKey === "perdido") {
    return "Bloqueada: marcar como perdido desde el detalle"
  }
  return "Etapa bloqueada"
}

export const PAYMENT_DOC_REQUIRED_FOR_WON =
  "Para marcar como ganado debes adjuntar un comprobante de pago (PDF o imagen) en «Documentos de Pago»."
