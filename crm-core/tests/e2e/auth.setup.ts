import { test as setup } from "@playwright/test"
import path from "path"

export const AUTH_FILE = path.join(__dirname, ".auth/demo-user.json")

setup("authenticate as demo user", async ({ page }) => {
  await page.goto("/signin")

  // Signin form uses Label "Correo" for email, "Contraseña" for password, button "Entrar"
  // Fill by input id to avoid label encoding issues
  await page.locator('input[name="email"], input[id="email"], input[type="email"]').first().fill("roberto@demo-aqua.local")
  await page.locator('input[name="password"], input[id="password"], input[type="password"]').first().fill("Demo1234!")
  await page.getByRole("button", { name: /entrar|iniciar sesión|sign in/i }).click()

  // Wait for redirect to the app (any tenant URL)
  await page.waitForURL(/\/app\//, { timeout: 15_000 })
  await page.context().storageState({ path: AUTH_FILE })
})
