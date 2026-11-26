import { test as setup } from "@playwright/test"
import path from "path"

export const MEMBER_AUTH_FILE = path.join(__dirname, ".auth/demo-member.json")

const BASE_URL = "http://localhost:3000"

setup("authenticate as demo MEMBER", async ({ page }) => {
  const csrfRes = await page.request.get(`${BASE_URL}/api/auth/csrf`)
  const { csrfToken } = await csrfRes.json()

  await page.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: new URLSearchParams({
      csrfToken,
      email: "emanuel@demo-aqua.local",
      password: "Demo1234!",
      redirect: "false",
      json: "true",
      callbackUrl: `${BASE_URL}/app`,
    }).toString(),
  })

  await page.goto(`${BASE_URL}/app`)
  await page.waitForURL(/\/app\/[^/]+\//, { timeout: 30_000 })
  await page.context().storageState({ path: MEMBER_AUTH_FILE })
})
