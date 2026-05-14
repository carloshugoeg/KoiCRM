import { test, expect } from "@playwright/test"
import path from "path"

const AUTH_FILE = path.join(__dirname, ".auth/demo-user.json")
test.use({ storageState: AUTH_FILE })

test("branding settings page is accessible", async ({ page }) => {
  await page.goto("/app/demo-aqua/settings/appearance")

  // Page should load without error
  await expect(page).not.toHaveURL(/error|404/)

  // Should show some branding-related content
  await expect(
    page.getByText(/color|branding|apariencia|appearance/i).first()
  ).toBeVisible({ timeout: 10_000 })
})
