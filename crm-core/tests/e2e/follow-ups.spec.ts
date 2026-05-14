import { test, expect } from "@playwright/test"
import { AUTH_FILE } from "./auth.setup"

test.use({ storageState: AUTH_FILE })

test.describe("Follow-ups", () => {
  test("can open a deal and see follow-up section", async ({ page }) => {
    await page.goto("/app/demo-aqua/pipeline")
    await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 15_000 })

    // Open first deal card
    const cards = page.locator('[aria-roledescription="draggable"]')
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })
    await cards.first().click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8_000 })

    // Look for follow-up section label (seguimiento)
    await expect(
      page.getByText(/seguimiento|follow.?up/i).first()
    ).toBeVisible({ timeout: 5_000 })

    await page.keyboard.press("Escape")
  })
})
