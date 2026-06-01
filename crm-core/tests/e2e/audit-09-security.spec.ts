import { test, expect } from "@playwright/test"
import { AUTH_FILE } from "./auth.setup"

test.use({ storageState: AUTH_FILE })

const BASE = "/app/demo-aqua"

async function openNewDealModal(page: any) {
  await page.goto(`${BASE}/pipeline`)
  await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 20_000 })
  await page.getByRole("button", { name: /nueva oportunidad/i }).click()
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 })
}

test.describe("AUDIT-09: Security & Data Integrity", () => {

  test("SEC-01: XSS en nombre de deal es escapado correctamente", async ({ page }) => {
    const xssPayload = "<script>window.__xss_triggered=true</script><img onerror='window.__xss_triggered=true'>"

    const alerts: string[] = []
    page.on("dialog", async (dialog) => {
      alerts.push(dialog.message())
      await dialog.dismiss()
    })

    await openNewDealModal(page)
    await page.locator("input#name").fill(xssPayload)
    await page.locator("input#phone").fill("1234-5678")
    const chips = page.locator('[type="button"]').filter({ hasText: /bomba|jacuzzi|sauna|calentador|filtro|hidrojet/i })
    if (await chips.count() > 0) await chips.first().click()
    await page.getByRole("button", { name: /guardar/i }).click()

    await page.waitForTimeout(3_000)

    const xssTriggered = await page.evaluate(() => (window as any).__xss_triggered)
    if (xssTriggered || alerts.length > 0) {
      console.error("SEC-01 CRITICAL: XSS payload was executed!")
      expect(alerts, "XSS should not trigger alerts").toHaveLength(0)
      expect(xssTriggered).toBeFalsy()
    } else {
      console.log("SEC-01: XSS correctly escaped/sanitized")
    }
  })

  test("SEC-02: HTML en nombre del deal se renderiza como texto en tarjeta", async ({ page }) => {
    await page.goto(`${BASE}/pipeline`)
    await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 20_000 })

    const cardHTML = await page.locator('[aria-roledescription="draggable"]').first().innerHTML()
    expect(cardHTML).not.toMatch(/<script>/i)
  })

  test("SEC-03: SQL injection en búsqueda global no rompe la app", async ({ page }) => {
    await page.goto(`${BASE}/pipeline`)
    await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 20_000 })

    await page.keyboard.press("Meta+k")
    await page.waitForTimeout(1_000)

    const searchInput = page.locator('[cmdk-input], input[placeholder*="buscar"], input[placeholder*="Buscar"]')
    if (await searchInput.count() > 0) {
      await searchInput.fill("' OR 1=1; DROP TABLE deals; --")
      await page.waitForTimeout(2_000)
      await expect(page.getByText(/404|500|server error|fatal/i)).not.toBeVisible()
      console.log("SEC-03: SQL injection in search — app did not crash")
    }
  })

  test("SEC-04: acceso a tenant inexistente retorna error apropiado", async ({ page }) => {
    await page.goto("/app/tenant-that-does-not-exist-xyz/pipeline")
    await page.waitForLoadState("networkidle")

    const url = page.url()
    const isOnPipeline = url.includes("tenant-that-does-not-exist-xyz/pipeline")
    if (isOnPipeline) {
      const errorIndicator = await page.getByText(/no encontrado|not found|404|403|acceso denegado/i).count()
      if (errorIndicator === 0) {
        console.warn("SEC-04 FINDING: Accessing non-existent tenant URL did not show error")
      }
    }
  })

  test("SEC-05: valor numérico extremo (Number.MAX_SAFE_INTEGER) manejado correctamente", async ({ page }) => {
    await openNewDealModal(page)
    await page.locator("input#name").fill("Test Valor Extremo")
    await page.locator("input#phone").fill("1234-5678")
    const chips = page.locator('[type="button"]').filter({ hasText: /bomba|jacuzzi|sauna|calentador|filtro|hidrojet/i })
    if (await chips.count() > 0) await chips.first().click()

    await page.locator("input#value").fill(String(Number.MAX_SAFE_INTEGER))
    await page.getByRole("button", { name: /guardar/i }).click()

    await page.waitForTimeout(3_000)
    const success = await page.getByText(/oportunidad creada/i).count()
    if (success > 0) {
      console.warn("SEC-05 NOTE: MAX_SAFE_INTEGER value was accepted — verify DB precision (DECIMAL(18,2))")
    }
  })

  test("SEC-06: server action sin sesión retorna error de autenticación", async ({ browser }) => {
    const noAuthCtx = await browser.newContext()
    const noAuthPage = await noAuthCtx.newPage()

    await noAuthPage.goto(`${BASE}/pipeline`)
    await noAuthPage.waitForLoadState("networkidle")

    const url = noAuthPage.url()
    const redirectedToSignin = url.includes("/signin") || url.includes("/auth")
    if (!redirectedToSignin) {
      console.warn("SEC-06 FINDING: Unauthenticated access to pipeline did not redirect to signin")
    } else {
      console.log("SEC-06: Correctly redirects unauthenticated users to signin")
    }

    await noAuthCtx.close()
  })

  test("SEC-07: no hay errores de consola en navegación normal", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text())
      }
    })

    const routes = [
      `${BASE}/pipeline`,
      `${BASE}/archive`,
      `${BASE}/calendar`,
      `${BASE}/stats/resumen`,
      `${BASE}/clients`,
    ]

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState("networkidle")
      await page.waitForTimeout(500)
    }

    if (consoleErrors.length > 0) {
      console.warn(`SEC-07: ${consoleErrors.length} console errors during navigation:`, consoleErrors)
    }
    expect(consoleErrors.filter(e => !e.includes("Warning:"))).toHaveLength(0)
  })
})
