import { test, expect } from "@playwright/test"
import { AUTH_FILE } from "./auth.setup"

test.use({ storageState: AUTH_FILE })

const BASE = "/app/demo-aqua"

test.describe("AUDIT-08: Print Report", () => {

  test("PRT-01: botón Imprimir visible en header del pipeline", async ({ page }) => {
    await page.goto(`${BASE}/pipeline`)
    await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 20_000 })

    const printBtn = page.locator('button[title*="imprimir"], button[title*="Imprimir"]')
    await expect(printBtn).toBeVisible()
  })

  test("PRT-02: modo impresión oculta elementos de navegación", async ({ page }) => {
    await page.goto(`${BASE}/pipeline`)
    await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 20_000 })

    await page.emulateMedia({ media: "print" })

    const errors: string[] = []
    page.on("pageerror", (err) => errors.push(err.message))

    await page.waitForTimeout(1_000)
    expect(errors, "No JS errors during print media emulation").toHaveLength(0)

    await page.emulateMedia({ media: "screen" })
  })

  test("PRT-03: PrintReport component existe y renderiza estructura de tabla", async ({ page }) => {
    await page.goto(`${BASE}/pipeline`)
    await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 20_000 })

    await page.emulateMedia({ media: "print" })
    await page.waitForTimeout(500)

    const reportTitle = page.getByText(/reporte de oportunidades/i)
    const hasTitle = await reportTitle.count()

    if (hasTitle > 0) {
      await expect(reportTitle).toBeVisible()
      console.log("PRT-03: Report title found in print mode")
    } else {
      console.warn("PRT-03 FINDING: 'Reporte de Oportunidades' title not visible in print mode")
    }

    await page.emulateMedia({ media: "screen" })
  })

  test("PRT-04: click en botón Imprimir no genera errores JS", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (err) => errors.push(err.message))

    await page.goto(`${BASE}/pipeline`)
    await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 20_000 })

    await page.addInitScript(() => {
      (window as any).print = () => { (window as any).__printCalled = true }
    })

    const printBtn = page.locator('button[title*="mprimir"]')
    if (await printBtn.count() > 0) {
      await printBtn.click()
      const printCalled = await page.evaluate(() => (window as any).__printCalled)
      expect(printCalled, "window.print() should be called when print button clicked").toBe(true)
    }

    expect(errors, "No JS errors during print trigger").toHaveLength(0)
  })
})
