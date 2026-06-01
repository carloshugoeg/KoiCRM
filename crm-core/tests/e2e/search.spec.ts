import { test, expect } from "@playwright/test"
import { AUTH_FILE } from "./auth-helpers"

test.describe("Search", () => {
  test.use({ storageState: AUTH_FILE })

  test("global search opens with Ctrl+K or Cmd+K", async ({ page }) => {
    await page.goto("/app/demo-aqua/pipeline")
    await expect(page.getByText(/prospecto/i)).toBeVisible({ timeout: 15_000 })

    // Trigger global search keyboard shortcut
    await page.keyboard.press("Meta+k")

    // The search dialog/combobox should appear
    const searchDialog = page.locator('[cmdk-root], [role="dialog"]').filter({ hasText: /buscar|search/i })
    const searchInput = page.getByPlaceholder(/buscar|search/i)

    const dialogVisible = await searchDialog.isVisible().catch(() => false)
    const inputVisible = await searchInput.isVisible().catch(() => false)

    expect(dialogVisible || inputVisible).toBe(true)
  })
})
