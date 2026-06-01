import { test, expect } from "@playwright/test"
import { AUTH_FILE } from "./auth.setup"

test.use({ storageState: AUTH_FILE })

const BASE = "/app/demo-aqua"

test.describe("AUDIT-06: Archive Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/archive`)
    await page.waitForLoadState("networkidle")
  })

  test("ARC-01: página de archivo carga sin error", async ({ page }) => {
    await expect(page.getByText(/404|500|server error/i)).not.toBeVisible()
  })

  test("ARC-02: tabla de archivo tiene columnas requeridas por especificación", async ({ page }) => {
    const columnHeaders = ["Fecha", "Oportunidad", "Empresa", "Etapa", "Asesor", "Valor"]
    for (const header of columnHeaders) {
      const el = page.getByText(new RegExp(`^${header}$`, "i"))
      const count = await el.count()
      if (count === 0) {
        console.warn(`ARC-02 FINDING: Column header "${header}" not found in archive table`)
      }
    }
    const table = page.locator("table, [role='table']")
    const hasTable = await table.count()
    if (hasTable === 0) {
      console.warn("ARC-02 FINDING: No table element found in archive page")
    }
  })

  test("ARC-03: controles de paginación presentes", async ({ page }) => {
    const pagination = page.getByText(/página \d+ de \d+/i)
    const hasPagination = await pagination.count()
    if (hasPagination > 0) {
      await expect(pagination).toBeVisible()
    } else {
      test.info().annotations.push({ type: "note", description: "Pagination text not found — may be empty or different structure" })
    }
  })

  test("ARC-04: click en fila de archive abre DealDetailModal", async ({ page }) => {
    const rows = page.locator("table tbody tr, [role='row']").filter({ hasNotText: /fecha|oportunidad/i })
    const count = await rows.count()

    if (count > 0) {
      await rows.first().click()
      await page.waitForTimeout(1_500)
      const overlay = page.locator(".fixed.inset-0").first()
      const hasOverlay = await overlay.isVisible()
      if (!hasOverlay) {
        console.warn("ARC-04 FINDING: Clicking archive row did not open DealDetailModal")
      }
    } else {
      test.info().annotations.push({ type: "note", description: "No archived records found" })
    }
  })

  test("ARC-05: deals archivados NO aparecen en pipeline activo", async ({ page }) => {
    await page.goto(`${BASE}/pipeline`)
    await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 15_000 })

    await page.goto(`${BASE}/archive`)
    await page.waitForLoadState("networkidle")

    const rows = page.locator("table tbody tr, [role='row']").filter({ hasNotText: /fecha|oportunidad/i })
    const count = await rows.count()

    if (count > 0) {
      const firstArchivedName = await rows.first().locator("td").nth(1).textContent()
      if (firstArchivedName) {
        await page.goto(`${BASE}/pipeline`)
        await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 15_000 })
        const archivedInPipeline = await page.locator('[aria-roledescription="draggable"]', {
          hasText: firstArchivedName.trim()
        }).count()
        expect(archivedInPipeline, `Archived deal "${firstArchivedName}" should not appear in pipeline`).toBe(0)
      }
    }
  })
})
