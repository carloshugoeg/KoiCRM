import { test, expect } from "@playwright/test"
import { AUTH_FILE } from "./auth-helpers"

test.use({ storageState: AUTH_FILE })

const BASE = "/app/demo-aqua"

// ─── Navigation ──────────────────────────────────────────────────────────────

test.describe("Settings – Navigation", () => {
  test("gear icon in header navigates to settings", async ({ page }) => {
    await page.goto(`${BASE}/pipeline`)
    // Wait for the kanban board heading (not a card text which repeats)
    await expect(page.locator("header")).toBeVisible({ timeout: 15_000 })

    await page.click('a[title="Configuración"]')
    await expect(page).toHaveURL(/\/settings\/appearance/, { timeout: 10_000 })
  })

  test("settings sidebar shows all five sections", async ({ page }) => {
    await page.goto(`${BASE}/settings/appearance`)
    const sidebar = page.locator("aside")
    await expect(sidebar).toBeVisible({ timeout: 10_000 })
    await expect(sidebar.getByText("Configuración")).toBeVisible()

    for (const label of ["Apariencia", "Embudo", "Catálogos", "Usuarios", "General"]) {
      await expect(sidebar.getByRole("link", { name: label, exact: true })).toBeVisible()
    }
  })

  test("sidebar Embudo link navigates to pipeline settings", async ({ page }) => {
    await page.goto(`${BASE}/settings/appearance`)
    const sidebar = page.locator("aside")
    await sidebar.getByRole("link", { name: "Embudo", exact: true }).click()
    await expect(page).toHaveURL(/\/settings\/pipeline/, { timeout: 10_000 })
    await expect(page.getByRole("heading", { name: /embudo/i })).toBeVisible()
  })

  test("settings link in header is marked active while on settings pages", async ({ page }) => {
    await page.goto(`${BASE}/settings/appearance`)
    const settingsLink = page.locator('a[title="Configuración"]')
    await expect(settingsLink).toHaveClass(/font-semibold/)
  })
})

// ─── Pipeline (Embudo) ────────────────────────────────────────────────────────

test.describe("Settings – Embudo (Pipeline)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/settings/pipeline`)
    await expect(page.getByRole("heading", { name: /embudo/i })).toBeVisible({ timeout: 15_000 })
  })

  test("stage list renders existing stages", async ({ page }) => {
    const items = page.locator("ul li")
    const count = await items.count()
    expect(count).toBeGreaterThanOrEqual(2)
    // Locked stages show the "Bloqueada" label
    await expect(page.getByText("Bloqueada").first()).toBeVisible()
  })

  test("add new stage — appears in list after router refresh", async ({ page }) => {
    const stageName = `E2E-${Date.now()}`

    const newStageForm = page.locator("form", { hasText: "Nueva etapa" })
    await newStageForm.locator("input").first().fill(stageName)
    await newStageForm.getByRole("button", { name: /agregar/i }).click()

    // router.refresh() re-renders server component with updated stages
    await expect(page.getByText(stageName)).toBeVisible({ timeout: 15_000 })
  })

  test("edit non-locked stage label and save", async ({ page }) => {
    // Step 1: find first non-locked row (has Eliminar button) and read its label
    const nonLockedRow = page.locator("li").filter({
      has: page.getByRole("button", { name: "Eliminar" }),
    }).first()
    await expect(nonLockedRow).toBeVisible({ timeout: 5_000 })
    const original = (await nonLockedRow.locator("p.font-medium").first().textContent()) ?? "stage"

    // Step 2: click Editar — after this the row switches to edit mode (no more Eliminar button)
    await nonLockedRow.getByRole("button", { name: "Editar" }).click()

    // Step 3: find the row that is NOW in edit mode (has a "Guardar" button)
    const editingRow = page.locator("li").filter({
      has: page.getByRole("button", { name: "Guardar" }),
    }).first()
    const labelInput = editingRow.locator("input").first()
    await expect(labelInput).toBeVisible({ timeout: 5_000 })

    await labelInput.clear()
    await labelInput.fill(`${original}-Edit`)
    await editingRow.getByRole("button", { name: "Guardar" }).click()

    await expect(page.getByText(`${original}-Edit`)).toBeVisible({ timeout: 10_000 })
  })

  test("delete a newly added stage", async ({ page }) => {
    const stageName = `Del-${Date.now()}`

    const newStageForm = page.locator("form", { hasText: "Nueva etapa" })
    await newStageForm.locator("input").first().fill(stageName)
    await newStageForm.getByRole("button", { name: /agregar/i }).click()
    await expect(page.getByText(stageName)).toBeVisible({ timeout: 15_000 })

    const row = page.locator("li", { hasText: stageName })
    page.once("dialog", (dialog) => dialog.accept())
    await row.getByRole("button", { name: /eliminar/i }).click()

    await expect(page.getByText(stageName)).not.toBeVisible({ timeout: 10_000 })
  })
})

// ─── Apariencia (Branding) ────────────────────────────────────────────────────

test.describe("Settings – Apariencia (Branding)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/settings/appearance`)
    await expect(page.getByRole("heading", { name: /apariencia/i })).toBeVisible({ timeout: 15_000 })
  })

  test("page shows all branding form fields", async ({ page }) => {
    await expect(page.getByLabel(/nombre del producto/i)).toBeVisible()
    await expect(page.getByLabel(/color primario/i)).toBeVisible()
    await expect(page.getByLabel(/logo \(url de imagen\)/i)).toBeVisible()
    await expect(page.getByLabel(/imagen de fondo/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /guardar apariencia/i })).toBeVisible()
  })

  test("save product name and see success message", async ({ page }) => {
    const nameInput = page.getByLabel(/nombre del producto/i)
    await nameInput.clear()
    await nameInput.fill("Koi CRM")

    await page.getByRole("button", { name: /guardar apariencia/i }).click()
    await expect(page.getByText(/guardado correctamente/i)).toBeVisible({ timeout: 10_000 })
  })

  test("logo URL renders live preview", async ({ page }) => {
    const logoInput = page.getByLabel(/logo \(url de imagen\)/i)
    await logoInput.fill("https://placehold.co/200x80/png")

    await expect(page.locator('img[alt="Logo preview"]')).toBeVisible({ timeout: 5_000 })
  })

  test("clearing logo URL hides the preview", async ({ page }) => {
    const logoInput = page.getByLabel(/logo \(url de imagen\)/i)

    await logoInput.fill("https://placehold.co/200x80/png")
    await expect(page.locator('img[alt="Logo preview"]')).toBeVisible({ timeout: 5_000 })

    await logoInput.clear()
    await expect(page.locator('img[alt="Logo preview"]')).not.toBeVisible()
  })
})
