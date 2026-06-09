import { test, expect } from "@playwright/test"
import { AUTH_FILE } from "./auth-helpers"

test.use({ storageState: AUTH_FILE })

test.describe("Session PIN toggle", () => {
  test("toggle requires PIN and changes lock state", async ({ page }) => {
    await page.goto("/app/demo-aqua/pipeline", { waitUntil: "networkidle" })
    await expect(page.getByText(/prospecto/i).first()).toBeVisible({ timeout: 15_000 })

    const pinSwitch = page.getByTestId("session-pin-toggle")
    await expect(pinSwitch).toBeVisible({ timeout: 8_000 })
    await expect(pinSwitch).toHaveAttribute("aria-checked", "false")

    await pinSwitch.click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText(/activar protección con pin/i)).toBeVisible()

    await page.getByLabel("PIN de 4 dígitos").fill("1234")
    await expect(pinSwitch).toHaveAttribute("aria-checked", "true", { timeout: 8_000 })

    await pinSwitch.click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8_000 })
    await page.getByLabel("PIN de 4 dígitos").fill("1234")
    await expect(pinSwitch).toHaveAttribute("aria-checked", "false", { timeout: 8_000 })
  })
})
