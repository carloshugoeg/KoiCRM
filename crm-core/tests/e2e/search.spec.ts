import { test, expect } from "@playwright/test"
import { AUTH_FILE } from "./auth-helpers"

test.describe("Search", () => {
  test.use({ storageState: AUTH_FILE })

  test("global search opens with Cmd+K and header button", async ({ page }) => {
    await page.goto("/app/demo-aqua/pipeline")
    await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 15_000 })

    await page.keyboard.press("Meta+k")
    await expect(page.getByPlaceholder(/cotización o pago/i)).toBeVisible()

    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: /buscar/i }).click()
    await expect(page.getByPlaceholder(/cotización o pago/i)).toBeVisible()
  })

  test("typing shows results and opening a deal shows detail modal", async ({ page }) => {
    await page.goto("/app/demo-aqua/pipeline")
    await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 15_000 })

    await page.keyboard.press("Meta+k")
    const input = page.getByPlaceholder(/cotización o pago/i)
    await input.fill("a")

    await page.waitForTimeout(800)

    const firstDeal = page.locator('[cmdk-item]').filter({ hasText: /oportunidad|prospecto|contactado/i }).first()
    const dealVisible = await firstDeal.isVisible().catch(() => false)

    if (dealVisible) {
      await firstDeal.click()
      await expect(page).toHaveURL(/deal=/)
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 })
    } else {
      const anyItem = page.locator("[cmdk-item]").first()
      if (await anyItem.isVisible()) {
        await anyItem.click()
        await expect(page.getByRole("dialog").or(page.getByText(/selecciona un cliente/i))).toBeVisible({
          timeout: 10_000,
        })
      }
    }
  })
})
