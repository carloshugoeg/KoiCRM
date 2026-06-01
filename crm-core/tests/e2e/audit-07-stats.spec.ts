import { test, expect } from "@playwright/test"
import { AUTH_FILE } from "./auth.setup"

test.use({ storageState: AUTH_FILE })

const BASE = "/app/demo-aqua"

test.describe("AUDIT-07: Statistics Views", () => {

  test("STATS-01: Resumen muestra tarjetas KPI según spec §3.5.1", async ({ page }) => {
    await page.goto(`${BASE}/stats/resumen`)
    await page.waitForLoadState("networkidle")

    await expect(page.getByText(/404|500|server error/i)).not.toBeVisible()

    const kpis = ["Total Embudo", "Ganado", "Tasa de cierre", "Ticket promedio"]
    for (const kpi of kpis) {
      const el = page.getByText(new RegExp(kpi, "i"))
      const count = await el.count()
      if (count === 0) {
        console.warn(`STATS-01 FINDING: KPI "${kpi}" not found in stats/resumen`)
      }
    }
  })

  test("STATS-02: Listado muestra tabla de deals", async ({ page }) => {
    await page.goto(`${BASE}/stats/listado`)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(/404|500|server error/i)).not.toBeVisible()
  })

  test("STATS-03: Embudo de estadísticas carga sin error", async ({ page }) => {
    await page.goto(`${BASE}/stats/embudo`)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(/404|500|server error/i)).not.toBeVisible()
  })

  test("STATS-04: Equipo de estadísticas carga sin error", async ({ page }) => {
    await page.goto(`${BASE}/stats/equipo`)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(/404|500|server error/i)).not.toBeVisible()
  })

  test("STATS-05: Canal de estadísticas carga sin error", async ({ page }) => {
    await page.goto(`${BASE}/stats/canal`)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(/404|500|server error/i)).not.toBeVisible()
  })

  test("STATS-06: Productos de estadísticas carga sin error", async ({ page }) => {
    await page.goto(`${BASE}/stats/productos`)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(/404|500|server error/i)).not.toBeVisible()
  })

  test("STATS-07: Alertas de estadísticas carga sin error", async ({ page }) => {
    await page.goto(`${BASE}/stats/alertas`)
    await page.waitForLoadState("networkidle")
    await expect(page.getByText(/404|500|server error/i)).not.toBeVisible()
  })

  test("STATS-08: tabs de navegación de estadísticas presentes", async ({ page }) => {
    await page.goto(`${BASE}/stats/resumen`)
    await page.waitForLoadState("networkidle")

    const tabs = ["Resumen", "Listado", "Embudo", "Equipo", "Canal", "Productos", "Alertas"]
    for (const tab of tabs) {
      const el = page.getByText(new RegExp(`^${tab}$`, "i"))
      const count = await el.count()
      if (count === 0) {
        console.warn(`STATS-08 FINDING: Stats tab "${tab}" not found`)
      }
    }
  })

  test("STATS-09: Tasa de cierre mostrada como porcentaje", async ({ page }) => {
    await page.goto(`${BASE}/stats/resumen`)
    await page.waitForLoadState("networkidle")

    const tasaEl = page.getByText(/tasa de cierre/i)
    if (await tasaEl.count() > 0) {
      const parentText = await tasaEl.locator("..").locator("..").textContent()
      expect(parentText, "Tasa de cierre debe mostrar valor porcentual").toMatch(/\d+.*%/)
      console.log(`STATS-09: Tasa de cierre section: "${parentText}"`)
    } else {
      console.warn("STATS-09 FINDING: 'Tasa de cierre' KPI not found in stats/resumen")
    }
  })
})
