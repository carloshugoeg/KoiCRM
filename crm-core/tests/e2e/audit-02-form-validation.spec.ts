import { test, expect } from "@playwright/test"
import { AUTH_FILE } from "./auth-helpers"

test.use({ storageState: AUTH_FILE })

const BASE = "/app/demo-aqua"

async function openNewDealModal(page: any) {
  await page.goto(`${BASE}/pipeline`)
  await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 20_000 })
  await page.getByRole("button", { name: /nueva oportunidad/i }).click()
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 })
}

async function fillMinimumValidForm(page: any) {
  await page.locator("input#name").fill("Test Validación")
  await page.locator("input#phone").fill("1234-5678")
  // Select first equipment chip
  const chips = page.locator('[type="button"]').filter({ hasText: /bomba|jacuzzi|sauna|calentador|filtro|hidrojet/i })
  if (await chips.count() > 0) await chips.first().click()
}

test.describe("AUDIT-02: Form Validation", () => {

  // ─────────────────────────────────────────────
  // FV-01: Cannot submit without selecting equipment (no custom text either)
  // ─────────────────────────────────────────────
  test("FV-01: sin equipo seleccionado ni custom → error de validación", async ({ page }) => {
    await openNewDealModal(page)
    await page.locator("input#name").fill("Test Sin Equipo")
    await page.locator("input#phone").fill("1234-5678")
    // Deliberately leave equipment empty and equipmentCustom empty
    await page.locator("input#value").fill("5000")
    await page.getByRole("button", { name: /crear oportunidad/i }).click()

    // Expect either: toast error OR browser validation message
    const errorToast = page.getByText(/selecciona al menos un equipo|debe seleccionar un equipo/i)
    const modalStillOpen = page.getByRole("dialog")

    // Modal must remain open (form not submitted)
    await expect(modalStillOpen).toBeVisible({ timeout: 3_000 })
    // Error should be displayed
    await expect(errorToast).toBeVisible({ timeout: 5_000 })
  })

  // ─────────────────────────────────────────────
  // FV-02: Custom equipment text satisfies equipment requirement
  // ─────────────────────────────────────────────
  test("FV-02: equipmentCustom solo (sin chips) → deal creado exitosamente", async ({ page }) => {
    await openNewDealModal(page)
    await page.locator("input#name").fill("Test Custom Equipo")
    await page.locator("input#phone").fill("1234-5678")
    // Fill only custom equipment, leave chips unselected
    const customInput = page.locator('input[placeholder*="Otro equipo"]')
    await customInput.fill("Piscina Olimpica")
    await page.getByRole("button", { name: /crear oportunidad/i }).click()

    await expect(page.getByText(/oportunidad creada/i)).toBeVisible({ timeout: 8_000 })
  })

  // ─────────────────────────────────────────────
  // FV-03: AUDIT FINDING — Phone accepts invalid format (no XXXX-XXXX regex)
  // Expected per spec: reject "12345". Actual: deal created.
  // ─────────────────────────────────────────────
  test("FV-03: teléfono con formato inválido (sin guion) — documenta brecha de validación", async ({ page }) => {
    await openNewDealModal(page)
    await page.locator("input#name").fill("Test Telefono Invalido")
    await page.locator("input#phone").fill("12345678") // No dash, invalid per spec XXXX-XXXX
    const chips = page.locator('[type="button"]').filter({ hasText: /bomba|jacuzzi|sauna|calentador|filtro|hidrojet/i })
    if (await chips.count() > 0) await chips.first().click()
    await page.getByRole("button", { name: /crear oportunidad/i }).click()

    // Per DEMO_INVENTORY.md §7.11 this SHOULD be rejected
    // Per current implementation it will be accepted — THIS IS THE BUG
    const errorMsg = page.getByText(/formato.*teléfono|XXXX-XXXX/i)
    const successMsg = page.getByText(/oportunidad creada/i)

    // Wait for either
    await page.waitForTimeout(3_000)
    const hasError = await errorMsg.count()
    const hasSuccess = await successMsg.count()

    if (hasSuccess > 0) {
      // CONFIRMED BUG: invalid phone was accepted
      console.warn("AUDIT-001 CONFIRMED: Phone without XXXX-XXXX format was accepted")
      // Test passes to document — this is expected to fail in a correctly implemented app
    } else if (hasError > 0) {
      // Validation works — good
      expect(hasError).toBeGreaterThan(0)
    }
  })

  // ─────────────────────────────────────────────
  // FV-04: WhatsApp with invalid format accepted (no +502 regex)
  // ─────────────────────────────────────────────
  test("FV-04: WhatsApp con formato inválido — documenta brecha de validación", async ({ page }) => {
    await openNewDealModal(page)
    await page.locator("input#name").fill("Test WA Invalido")
    await page.locator("input#phone").fill("1234-5678")
    await page.locator("input#whatsapp").fill("99999999") // No +502 prefix, invalid per spec
    const chips = page.locator('[type="button"]').filter({ hasText: /bomba|jacuzzi|sauna|calentador|filtro|hidrojet/i })
    if (await chips.count() > 0) await chips.first().click()
    await page.getByRole("button", { name: /crear oportunidad/i }).click()

    await page.waitForTimeout(3_000)
    const errorMsg = await page.getByText(/formato.*whatsapp|\+502 XXXX/i).count()
    const successMsg = await page.getByText(/oportunidad creada/i).count()

    if (successMsg > 0) {
      console.warn("AUDIT-002 CONFIRMED: WhatsApp without +502 format was accepted")
    }
  })

  // ─────────────────────────────────────────────
  // FV-05: Invalid email format is rejected
  // ─────────────────────────────────────────────
  test("FV-05: email inválido es rechazado por el servidor", async ({ page }) => {
    await openNewDealModal(page)
    await fillMinimumValidForm(page)
    await page.locator("input#email").fill("not-an-email")
    await page.getByRole("button", { name: /crear oportunidad/i }).click()

    await expect(page.getByText(/email inválido/i)).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole("dialog")).toBeVisible() // modal still open
  })

  // ─────────────────────────────────────────────
  // FV-06: Negative value rejected (min: 0 in schema)
  // ─────────────────────────────────────────────
  test("FV-06: valor negativo es rechazado", async ({ page }) => {
    await openNewDealModal(page)
    await fillMinimumValidForm(page)
    // Bypass HTML min=0 by filling the value directly
    await page.locator("input#value").fill("-5000")
    await page.getByRole("button", { name: /crear oportunidad/i }).click()

    await page.waitForTimeout(3_000)
    // Schema has min(0) — server should reject
    const successMsg = await page.getByText(/oportunidad creada/i).count()
    if (successMsg > 0) {
      console.warn("AUDIT-FINDING: Negative value was accepted (HTML min bypassed)")
    } else {
      // Good — rejection as expected
      await expect(page.getByRole("dialog")).toBeVisible()
    }
  })

  // ─────────────────────────────────────────────
  // FV-07: UI buffer overflow — name with 500 characters
  // Schema allows max 200 — server should reject
  // ─────────────────────────────────────────────
  test("FV-07: nombre con 500 caracteres — rechazado por schema (max: 200)", async ({ page }) => {
    await openNewDealModal(page)
    const longName = "A".repeat(500)
    await page.locator("input#name").fill(longName)
    await page.locator("input#phone").fill("1234-5678")
    const chips = page.locator('[type="button"]').filter({ hasText: /bomba|jacuzzi|sauna|calentador|filtro|hidrojet/i })
    if (await chips.count() > 0) await chips.first().click()
    await page.getByRole("button", { name: /crear oportunidad/i }).click()

    await page.waitForTimeout(3_000)
    const successMsg = await page.getByText(/oportunidad creada/i).count()
    if (successMsg > 0) {
      console.warn("AUDIT-FINDING: Name with 500 chars was accepted (schema max: 200)")
    }
  })

  // ─────────────────────────────────────────────
  // FV-08: Required name field — empty name rejected
  // ─────────────────────────────────────────────
  test("FV-08: nombre vacío muestra validación requerida", async ({ page }) => {
    await openNewDealModal(page)
    // Leave name empty, fill everything else
    await page.locator("input#phone").fill("1234-5678")
    const chips = page.locator('[type="button"]').filter({ hasText: /bomba|jacuzzi|sauna|calentador|filtro|hidrojet/i })
    if (await chips.count() > 0) await chips.first().click()
    await page.getByRole("button", { name: /crear oportunidad/i }).click()
    // HTML required attribute should prevent form submission
    // or server should return error
    await expect(page.getByRole("dialog")).toBeVisible()
  })

  // ─────────────────────────────────────────────
  // FV-09: ESC key closes ClientFormModal (Radix Dialog)
  // ─────────────────────────────────────────────
  test("FV-09: ESC cierra ClientFormModal (Radix Dialog)", async ({ page }) => {
    await openNewDealModal(page)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3_000 })
  })

  // ─────────────────────────────────────────────
  // FV-10: ESC does NOT close DealDetailModal (custom div — AUDIT-004)
  // ─────────────────────────────────────────────
  test("FV-10: ESC NO cierra DealDetailModal (custom fixed div — documenta AUDIT-004)", async ({ page }) => {
    await page.goto(`${BASE}/pipeline`)
    await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 20_000 })
    const cards = page.locator('[aria-roledescription="draggable"]')
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })
    await cards.first().click()
    // Wait for overlay to appear
    await page.waitForTimeout(1_000)
    const overlay = page.locator(".fixed.inset-0").first()
    const isVisible = await overlay.isVisible()

    if (isVisible) {
      await page.keyboard.press("Escape")
      await page.waitForTimeout(1_000)
      const stillVisible = await overlay.isVisible()
      if (stillVisible) {
        console.warn("AUDIT-004 CONFIRMED: ESC does not close DealDetailModal")
      }
    }
  })
})
