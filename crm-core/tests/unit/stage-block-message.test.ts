import { describe, it, expect } from "vitest"
import { lockedStageDropMessage, lockedStageColumnHint } from "@/lib/pipeline/stage-block-message"

describe("stage block messages", () => {
  it("ganado sin comprobante explica el documento de pago", () => {
    const msg = lockedStageDropMessage({
      stageKey: "ganado",
      stageLabel: "Ganado",
      hasPaymentWithFile: false,
    })
    expect(msg).toMatch(/documento de pago/i)
  })

  it("ganado con comprobante indica usar el detalle", () => {
    const msg = lockedStageDropMessage({
      stageKey: "ganado",
      stageLabel: "Ganado",
      hasPaymentWithFile: true,
    })
    expect(msg).toMatch(/marcar como ganado/i)
  })
})
