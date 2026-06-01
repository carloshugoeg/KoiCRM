import { test as setup } from "@playwright/test"
import { AUTH_FILE } from "./auth-helpers"

export { AUTH_FILE }

const BASE_URL = "http://localhost:3000"

setup("authenticate as demo user", async ({ page }) => {
  // Step 1: get CSRF token from NextAuth
  const csrfRes = await page.request.get(`${BASE_URL}/api/auth/csrf`)
  const { csrfToken } = await csrfRes.json()

  // Step 2: POST credentials to NextAuth — this sets the session-token cookie
  await page.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: new URLSearchParams({
      csrfToken,
      email: "roberto@demo-aqua.local",
      password: "Demo1234!",
      redirect: "false",
      json: "true",
      callbackUrl: `${BASE_URL}/app`,
    }).toString(),
  })

  // Step 3: Navigate to the app to verify the session is valid and get final cookies
  await page.goto(`${BASE_URL}/app`)
  await page.waitForURL(/\/app\/[^/]+\//, { timeout: 30_000 })

  // Save full browser state (cookies + localStorage)
  await page.context().storageState({ path: AUTH_FILE })
})
