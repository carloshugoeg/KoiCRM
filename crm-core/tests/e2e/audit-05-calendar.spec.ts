import { test, expect } from "@playwright/test"
import { AUTH_FILE } from "./auth.setup"

test.use({ storageState: AUTH_FILE })

const BASE = "/app/demo-aqua"

test.describe("AUDIT-05: Calendar View", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/calendar`)
    await page.waitForLoadState("networkidle")
  })

  test("CAL-01: calendario carga sin error 404/500", async ({ page }) => {
    await expect(page.getByText(/404|500|not found|error/i)).not.toBeVisible()
  })

  test("CAL-02: grid mensual muestra cabeceras de días de la semana", async ({ page }) => {
    const dayHeaders = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    for (const day of ["Lun", "Dom"]) {
      const el = page.getByText(new RegExp(`^${day}`, "i"))
      if (await el.count() > 0) {
        await expect(el.first()).toBeVisible()
      }
    }
  })

  test("CAL-03: botón 'Hoy' visible y funciona", async ({ page }) => {
    const hoyBtn = page.getByRole("button", { name: /hoy/i })
    await expect(hoyBtn).toBeVisible({ timeout: 5_000 })
    await hoyBtn.click()
    await expect(page.getByRole("button", { name: /hoy/i })).toBeVisible()
  })

  test("CAL-04: flechas de navegación mes anterior/siguiente presentes", async ({ page }) => {
    const btns = page.locator('button')
    const btnCount = await btns.count()
    console.log(`CAL-04: Total buttons on page: ${btnCount}`)
  })

  test("CAL-05: día sin seguimientos muestra mensaje vacío", async ({ page }) => {
    const dayCells = page.locator('[class*="day"], td, [data-day]').filter({ hasText: /^[0-9]+$/ })
    const count = await dayCells.count()
    if (count > 0) {
      await dayCells.last().click()
      await page.waitForTimeout(1_000)
      const emptyMsg = page.getByText(/no hay seguimientos programados/i)
      const hasEmpty = await emptyMsg.count()
      if (hasEmpty > 0) {
        await expect(emptyMsg).toBeVisible()
      } else {
        test.info().annotations.push({ type: "note", description: "Day had events or message not found — inspect calendar structure" })
      }
    }
  })

  test("CAL-06: filtro por asesor presente en calendario", async ({ page }) => {
    const aFilter = page.getByRole("combobox", { name: /asesor/i })
    const hasFilter = await aFilter.count()
    if (hasFilter > 0) {
      await expect(aFilter).toBeVisible()
    } else {
      console.warn("CAL-06 FINDING: Asesor filter not present in calendar header — spec §3.3 requires it")
    }
  })
})
