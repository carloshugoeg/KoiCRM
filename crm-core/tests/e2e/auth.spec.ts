import { test, expect } from "@playwright/test"

// No stored auth — test the unauthenticated flows
test.use({ storageState: { cookies: [], origins: [] } })

test.describe("Authentication", () => {
  test("signin with valid credentials redirects to app", async ({ page }) => {
    await page.goto("/signin")
    // Use input selectors to avoid label encoding issues across environments
    await page.locator('input[name="email"], input[id="email"], input[type="email"]').first().fill("roberto@demo-aqua.local")
    await page.locator('input[name="password"], input[id="password"], input[type="password"]').first().fill("Demo1234!")
    await page.getByRole("button", { name: /entrar|iniciar sesión|sign in/i }).click()
    await page.waitForURL(/demo-aqua/, { timeout: 15_000 })
    await expect(page).toHaveURL(/demo-aqua/)
  })

  test("signin with wrong password shows error", async ({ page }) => {
    await page.goto("/signin")
    await page.locator('input[name="email"], input[id="email"], input[type="email"]').first().fill("roberto@demo-aqua.local")
    await page.locator('input[name="password"], input[id="password"], input[type="password"]').first().fill("wrong-password")
    await page.getByRole("button", { name: /entrar|iniciar sesión|sign in/i }).click()
    // Error message: "Correo o contraseña incorrectos."
    await expect(
      page.getByText(/credenciales|inválido|error|contraseña|incorrectos|invalid/i)
    ).toBeVisible({ timeout: 8_000 })
  })
})
