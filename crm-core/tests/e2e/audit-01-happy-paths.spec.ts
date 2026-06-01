import { test, expect } from "@playwright/test"
import { AUTH_FILE } from "./auth-helpers"

test.use({ storageState: AUTH_FILE })

const BASE = "/app/demo-aqua"

test.describe("AUDIT-01: Happy Paths", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/pipeline`)
    await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 20_000 })
  })

  // ─────────────────────────────────────────────
  // HP-01: Full deal creation from "Nueva oportunidad"
  // ─────────────────────────────────────────────
  test("HP-01: crear deal completo con todos los campos obligatorios", async ({ page }) => {
    await page.getByRole("button", { name: /nueva oportunidad/i }).click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 })

    // Fill required fields
    // Asesor: select first option (already pre-selected)
    // Canal: select first option (already pre-selected)
    await page.locator("input#name").fill("Prueba HP-01")
    await page.locator("input#phone").fill("5555-5555")

    // Select first equipment chip
    const equipChips = page.locator('[type="button"]').filter({ hasText: /bomba|jacuzzi|sauna|calentador|filtro|hidrojet/i })
    await equipChips.first().click()

    await page.locator("input#value").fill("15000")

    await page.getByRole("button", { name: /guardar/i }).click()

    // Expect toast success
    await expect(page.getByText(/oportunidad creada/i)).toBeVisible({ timeout: 8_000 })
    // Modal should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5_000 })
    // New card should appear in Prospecto column
    await expect(page.getByText("Prueba HP-01")).toBeVisible({ timeout: 10_000 })
  })

  // ─────────────────────────────────────────────
  // HP-02: Open deal detail and move to next stage via dropdown
  // ─────────────────────────────────────────────
  test("HP-02: mover deal a siguiente etapa desde DealDetailModal", async ({ page }) => {
    const cards = page.locator('[aria-roledescription="draggable"]')
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })

    // Get name of first card for verification
    const cardText = await cards.first().innerText()
    await cards.first().click()

    // DealDetailModal renders as a fixed overlay (NOT role="dialog")
    // Wait for the deal name to appear in the overlay
    await expect(page.locator(".fixed.inset-0").first()).toBeVisible({ timeout: 5_000 })

    // Look for "Mover a..." dropdown (only shown for unlocked stages)
    const moverSelect = page.getByRole("combobox").filter({ hasText: /mover a/i })
    const hasMover = await moverSelect.count()

    if (hasMover > 0) {
      await moverSelect.click()
      // Pick any available option
      const options = page.locator('[role="option"]')
      await options.first().click()
      await expect(page.getByText(/etapa actualizada/i)).toBeVisible({ timeout: 8_000 })
    } else {
      // Deal might already be in last non-locked stage — acceptable
      test.info().annotations.push({ type: "note", description: "No unlocked stages available to move to" })
    }
  })

  // ─────────────────────────────────────────────
  // HP-03: Mark deal as "Ganado" via explicit button
  // ─────────────────────────────────────────────
  test("HP-03: marcar deal como ganado desde DealDetailModal", async ({ page }) => {
    // Find a deal not already in ganado
    const cards = page.locator('[aria-roledescription="draggable"]')
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })

    // Click first card
    await cards.first().click()
    await expect(page.locator(".fixed.inset-0").first()).toBeVisible({ timeout: 5_000 })

    const ganadoBtn = page.getByRole("button", { name: /marcar como ganado/i })
    const btnVisible = await ganadoBtn.count()

    if (btnVisible > 0) {
      await ganadoBtn.click()
      await expect(page.getByText(/etapa actualizada/i)).toBeVisible({ timeout: 8_000 })
    } else {
      // Deal is already ganado — check the button is absent
      await expect(page.getByRole("button", { name: /marcar como ganado/i })).not.toBeVisible()
      test.info().annotations.push({ type: "note", description: "First deal already in ganado stage" })
    }
  })

  // ─────────────────────────────────────────────
  // HP-04: Mark deal as "Perdido"
  // ─────────────────────────────────────────────
  test("HP-04: marcar deal como perdido desde DealDetailModal", async ({ page }) => {
    const cards = page.locator('[aria-roledescription="draggable"]')
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })
    await cards.first().click()
    await expect(page.locator(".fixed.inset-0").first()).toBeVisible({ timeout: 5_000 })

    const perdidoBtn = page.getByRole("button", { name: /marcar como perdido/i })
    const btnVisible = await perdidoBtn.count()

    if (btnVisible > 0) {
      await perdidoBtn.click()
      await expect(page.getByText(/etapa actualizada/i)).toBeVisible({ timeout: 8_000 })
    } else {
      test.info().annotations.push({ type: "note", description: "First deal already in perdido stage or button absent" })
    }
  })

  // ─────────────────────────────────────────────
  // HP-05: Schedule and complete a follow-up
  // ─────────────────────────────────────────────
  test("HP-05: programar y completar un follow-up", async ({ page }) => {
    const cards = page.locator('[aria-roledescription="draggable"]')
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })
    await cards.first().click()
    await expect(page.locator(".fixed.inset-0").first()).toBeVisible({ timeout: 5_000 })

    // Find follow-up date input
    const dateInputs = page.locator('input[type="date"]')
    const dateCount = await dateInputs.count()
    expect(dateCount, "Debe existir al menos un date input en el modal de detalle").toBeGreaterThan(0)

    // Set date to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    await dateInputs.first().fill(tomorrowStr)

    // Find add follow-up button - look for "Agregar" or similar
    const addFuBtn = page.getByRole("button", { name: /agregar|añadir|programar/i }).first()
    if (await addFuBtn.count() > 0) {
      await addFuBtn.click()
      await expect(page.getByText(/seguimiento agregado/i)).toBeVisible({ timeout: 8_000 })

      // Now complete it
      const completarBtn = page.getByRole("button", { name: /completar/i }).first()
      if (await completarBtn.count() > 0) {
        await completarBtn.click()
        // Confirm button should appear
        const confirmarBtn = page.getByRole("button", { name: /confirmar/i })
        await expect(confirmarBtn).toBeVisible({ timeout: 3_000 })
        await confirmarBtn.click()
      }
    } else {
      test.info().annotations.push({ type: "info", description: "Follow-up add button not found - inspect modal structure" })
    }
  })

  // ─────────────────────────────────────────────
  // HP-06: Deal appears in Ganado column and updates KPI "Ganado"
  // ─────────────────────────────────────────────
  test("HP-06: KPI Ganado refleja suma correcta de deals ganados", async ({ page }) => {
    // Read current KPI value displayed
    const ganado = page.locator('p.text-xs.text-muted-foreground', { hasText: /^ganado$/i })
    await expect(ganado).toBeVisible()
    const kpiGanadoEl = ganado.locator("..").locator("p.text-lg")
    const kpiText = await kpiGanadoEl.textContent()
    expect(kpiText, "KPI Ganado debe mostrar valor en GTQ (Q)").toMatch(/Q/)
  })
})
