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

  test("settings tabs match demo order (Apariencia, Usuarios, Equipos, Embudo)", async ({ page }) => {
    await page.goto(`${BASE}/settings/appearance`)
    await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible({ timeout: 10_000 })

    for (const label of ["Apariencia", "Usuarios", "Equipos", "Embudo"]) {
      await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible()
    }
  })

  test("Embudo tab navigates to pipeline settings", async ({ page }) => {
    await page.goto(`${BASE}/settings/appearance`)
    await page.getByRole("link", { name: "Embudo", exact: true }).click()
    await expect(page).toHaveURL(/\/settings\/pipeline/, { timeout: 10_000 })
    await expect(page.getByText("Etapas del embudo")).toBeVisible()
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
    await expect(page.getByText("Etapas del embudo")).toBeVisible({ timeout: 15_000 })
  })

  test("stage list renders existing stages", async ({ page }) => {
    const items = page.locator("ul li")
    const count = await items.count()
    expect(count).toBeGreaterThanOrEqual(2)
    // Locked stages show the "Bloqueada" label
    await expect(page.getByText("Fijo").first()).toBeVisible()
  })

  test("add new stage — appears in list after router refresh", async ({ page }) => {
    const stageName = `E2E-${Date.now()}`

    await page.getByPlaceholder("Ej. Demo").fill(stageName)
    await page.getByRole("button", { name: /agregar etapa/i }).click()

    // router.refresh() re-renders server component with updated stages
    await expect(page.getByText(stageName)).toBeVisible({ timeout: 15_000 })
  })

  test("edit non-locked stage label inline", async ({ page }) => {
    const labelInput = page.getByPlaceholder("Etiqueta").first()
    await expect(labelInput).toBeVisible({ timeout: 5_000 })
    const original = (await labelInput.inputValue()) || "stage"

    await labelInput.clear()
    await labelInput.fill(`${original}-Edit`)
    await labelInput.blur()

    await expect(page.getByText(`${original}-Edit`)).toBeVisible({ timeout: 10_000 })
  })

  test("delete a newly added stage", async ({ page }) => {
    const stageName = `Del-${Date.now()}`

    await page.getByPlaceholder("Ej. Demo").fill(stageName)
    await page.getByRole("button", { name: /agregar etapa/i }).click()
    await expect(page.getByText(stageName)).toBeVisible({ timeout: 15_000 })

    const row = page.locator("div.rounded-xl", { hasText: stageName })
    page.once("dialog", (dialog) => dialog.accept())
    await row.getByRole("button", { name: "Eliminar etapa" }).click()

    await expect(page.getByText(stageName)).not.toBeVisible({ timeout: 10_000 })
  })
})

// ─── Equipos (Equipment catalog) ─────────────────────────────────────────────

test.describe("Settings – Equipos", () => {
  test("add equipment — visible in settings and new deal form", async ({ page }) => {
    const equipName = `E2E-Equipo-${Date.now()}`

    await page.goto(`${BASE}/settings/equipment`)
    await expect(page.getByText("Tipos de equipo")).toBeVisible({ timeout: 15_000 })

    await page.getByPlaceholder(/Bomba sumergible/i).fill(equipName)
    await page
      .locator("div.flex.gap-2")
      .filter({ has: page.getByPlaceholder(/Bomba sumergible/i) })
      .getByRole("button")
      .click()

    await expect(page.getByText(equipName)).toBeVisible({ timeout: 15_000 })

    await page.goto(`${BASE}/pipeline`)
    await expect(page.locator("header")).toBeVisible({ timeout: 15_000 })
    await page.getByRole("button", { name: /nueva oportunidad/i }).click()
    await expect(page.getByRole("button", { name: equipName })).toBeVisible({ timeout: 15_000 })
  })
})

// ─── Apariencia (Branding) ────────────────────────────────────────────────────

test.describe("Settings – Apariencia (Branding)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/settings/appearance`)
    await expect(page.getByText("Modo de pantalla")).toBeVisible({ timeout: 15_000 })
  })

  test("page shows demo appearance sections", async ({ page }) => {
    await expect(page.getByText("Modo de pantalla")).toBeVisible()
    await expect(page.getByText("Fondo oscuro")).toBeVisible()
    await expect(page.getByText("Logotipo de la empresa")).toBeVisible()
    await expect(page.getByText("Mostrar oportunidades archivadas")).toBeVisible()
    await expect(page.getByRole("button", { name: /subir fondo/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /subir imagen/i })).toBeVisible()
  })

  test("toggle show archived preference", async ({ page }) => {
    const toggle = page.getByRole("switch", { name: "" }).or(
      page.locator('button[role="switch"]'),
    ).first()
    await toggle.click()
    await page.reload()
    await expect(page.locator('button[role="switch"]')).toBeVisible()
  })
})
