import { test, expect } from "@playwright/test"
import path from "path"

const AUTH_FILE = path.join(__dirname, ".auth/demo-user.json")
test.use({ storageState: AUTH_FILE })

test.describe("Pipeline / Deals", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/demo-aqua/pipeline")
    await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 15_000 })
  })

  test("pipeline loads with kanban columns", async ({ page }) => {
    await expect(page.getByText(/prospecto/i)).toBeVisible()
    await expect(page.getByText(/contactado/i)).toBeVisible()
    await expect(page.getByText(/cotización/i)).toBeVisible()
    await expect(page.getByText(/ganado/i)).toBeVisible()
  })

  test("deal cards are keyboard-accessible (have tabIndex via dnd-kit)", async ({ page }) => {
    const cards = page.locator('[aria-roledescription="draggable"]')
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })
    // Cards should be focusable
    await cards.first().focus()
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-roledescription"))
    expect(focused).toBe("draggable")
  })

  test("FilterBar selects have aria-labels", async ({ page }) => {
    const ownerFilter = page.getByRole("combobox", { name: /asesor/i })
    await expect(ownerFilter).toBeVisible()
    const canalFilter = page.getByRole("combobox", { name: /canal/i })
    await expect(canalFilter).toBeVisible()
  })
})
