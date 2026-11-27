#!/usr/bin/env node
/**
 * VERIFY-ONLY Playwright driver for control-koicrm browser.
 * Prefer role/name/ARIA over CSS. State file: $KOICRM_VERIFY_RUN_DIR/browser-state.json
 */
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const crmCore = path.resolve(__dirname, "../../../../crm-core")
const rootRequire = createRequire(path.join(crmCore, "package.json"))
const playwrightRequire = createRequire(rootRequire.resolve("@playwright/test"))
const { chromium } = playwrightRequire("playwright")

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100"
const runDir = process.env.KOICRM_VERIFY_RUN_DIR || path.join(process.cwd(), ".verify/runs/adhoc")
const evidenceDir = process.env.KOICRM_VERIFY_EVIDENCE_DIR || path.join("/tmp/koicrm-verify-evidence", "adhoc")
const statePath = path.join(runDir, "browser-state.json")
const contextStatePath = path.join(runDir, "storage-state.json")

fs.mkdirSync(runDir, { recursive: true })
fs.mkdirSync(evidenceDir, { recursive: true })

function usage() {
  console.log(`Usage:
  control-koicrm browser goto --url <path-or-url>
  control-koicrm browser fill --role <role> --name <name> --value <text>
  control-koicrm browser fill --selector <css> --value <text>
  control-koicrm browser click --role <role> --name <name>
  control-koicrm browser click --selector <css>
  control-koicrm browser press --key <key>
  control-koicrm browser wait --text <text> [--timeout 15000]
  control-koicrm browser snapshot --aria --path <rel-or-abs>
  control-koicrm browser screenshot --path <rel-or-abs>
  control-koicrm browser download-click --role <role> --name <name> --path <file>
  control-koicrm browser eval --js <expression>
  control-koicrm browser auth-credentials --email <e> --password <p>
`)
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (!next || next.startsWith("--")) out[key] = true
      else {
        out[key] = next
        i++
      }
    } else out._.push(a)
  }
  return out
}

function resolveArtifact(p) {
  if (!p) throw new Error("missing --path")
  if (path.isAbsolute(p)) return p
  return path.join(evidenceDir, p)
}

async function withPage(fn) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    baseURL,
    acceptDownloads: true,
    storageState: fs.existsSync(contextStatePath) ? contextStatePath : undefined,
  })
  const page = await context.newPage()
  try {
    const result = await fn(page, context)
    await context.storageState({ path: contextStatePath })
    return result
  } finally {
    await browser.close()
  }
}

function locator(page, args) {
  if (args.selector) return page.locator(args.selector).first()
  if (args.role) {
    const opts = {}
    if (args.name) opts.name = new RegExp(args.name, "i")
    return page.getByRole(args.role, opts).first()
  }
  if (args.label) return page.getByLabel(new RegExp(args.label, "i")).first()
  if (args.placeholder) return page.getByPlaceholder(new RegExp(args.placeholder, "i")).first()
  if (args.text) return page.getByText(new RegExp(args.text, "i")).first()
  throw new Error("Need --role/--name, --selector, --label, --placeholder, or --text")
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const action = args._[0]
  if (!action || action === "help") {
    usage()
    process.exit(action ? 0 : 1)
  }

  if (action === "goto") {
    const url = args.url || args._[1]
    if (!url) throw new Error("--url required")
    await withPage(async (page) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 })
      console.log(`OK goto ${page.url()}`)
    })
    return
  }

  if (action === "fill") {
    await withPage(async (page) => {
      if (!page.url() || page.url() === "about:blank") await page.goto(baseURL)
      // Re-open last URL if stored
      if (fs.existsSync(statePath)) {
        const st = JSON.parse(fs.readFileSync(statePath, "utf8"))
        if (st.url) await page.goto(st.url, { waitUntil: "domcontentloaded" })
      }
      const loc = locator(page, args)
      await loc.fill(String(args.value ?? ""))
      fs.writeFileSync(statePath, JSON.stringify({ url: page.url() }, null, 2))
      console.log("OK fill")
    })
    return
  }

  if (action === "click") {
    await withPage(async (page) => {
      if (fs.existsSync(statePath)) {
        const st = JSON.parse(fs.readFileSync(statePath, "utf8"))
        if (st.url) await page.goto(st.url, { waitUntil: "domcontentloaded" })
      }
      await locator(page, args).click()
      await page.waitForTimeout(500)
      fs.writeFileSync(statePath, JSON.stringify({ url: page.url() }, null, 2))
      console.log(`OK click url=${page.url()}`)
    })
    return
  }

  if (action === "press") {
    await withPage(async (page) => {
      if (fs.existsSync(statePath)) {
        const st = JSON.parse(fs.readFileSync(statePath, "utf8"))
        if (st.url) await page.goto(st.url, { waitUntil: "domcontentloaded" })
      }
      await page.keyboard.press(args.key || args._[1])
      console.log("OK press")
    })
    return
  }

  if (action === "wait") {
    await withPage(async (page) => {
      if (fs.existsSync(statePath)) {
        const st = JSON.parse(fs.readFileSync(statePath, "utf8"))
        if (st.url) await page.goto(st.url, { waitUntil: "domcontentloaded" })
      }
      const timeout = Number(args.timeout || 15_000)
      if (args.text) {
        const state = args.attached ? "attached" : "visible"
        await page.getByText(new RegExp(args.text, "i")).first().waitFor({ state, timeout })
      } else if (args.url) await page.waitForURL(new RegExp(args.url), { timeout })
      else throw new Error("--text or --url required")
      fs.writeFileSync(statePath, JSON.stringify({ url: page.url() }, null, 2))
      console.log("OK wait")
    })
    return
  }

  if (action === "snapshot") {
    await withPage(async (page) => {
      if (fs.existsSync(statePath)) {
        const st = JSON.parse(fs.readFileSync(statePath, "utf8"))
        if (st.url) await page.goto(st.url, { waitUntil: "domcontentloaded" })
      }
      const out = resolveArtifact(args.path || "snapshot.aria.txt")
      fs.mkdirSync(path.dirname(out), { recursive: true })
      let aria
      if (typeof page.locator("body").ariaSnapshot === "function") {
        aria = await page.locator("body").ariaSnapshot()
      } else {
        const snap = await page.accessibility.snapshot()
        aria = JSON.stringify(snap, null, 2)
      }
      fs.writeFileSync(out, aria)
      console.log(`OK snapshot ${out}`)
    })
    return
  }

  if (action === "screenshot") {
    await withPage(async (page) => {
      if (fs.existsSync(statePath)) {
        const st = JSON.parse(fs.readFileSync(statePath, "utf8"))
        if (st.url) await page.goto(st.url, { waitUntil: "domcontentloaded" })
      }
      const out = resolveArtifact(args.path || "screenshot.png")
      fs.mkdirSync(path.dirname(out), { recursive: true })
      await page.screenshot({ path: out, fullPage: true })
      console.log(`OK screenshot ${out}`)
    })
    return
  }

  if (action === "download-click") {
    await withPage(async (page) => {
      if (fs.existsSync(statePath)) {
        const st = JSON.parse(fs.readFileSync(statePath, "utf8"))
        if (st.url) await page.goto(st.url, { waitUntil: "domcontentloaded" })
      }
      const out = resolveArtifact(args.path || "download.bin")
      fs.mkdirSync(path.dirname(out), { recursive: true })
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }),
        locator(page, args).click(),
      ])
      await download.saveAs(out)
      console.log(`OK download ${out} suggested=${download.suggestedFilename()}`)
    })
    return
  }

  if (action === "auth-credentials") {
    const email = args.email
    const password = args.password
    if (!email || !password) throw new Error("--email and --password required")
    await withPage(async (page, context) => {
      // Prefer the same NextAuth credentials callback the repo e2e setup uses.
      // The visible form is still the user path for sign-in.md failure proofs;
      // happy-path session bootstrap must not race hydration with a raw GET submit.
      const csrfRes = await page.request.get(`${baseURL}/api/auth/csrf`)
      const { csrfToken } = await csrfRes.json()
      await page.request.post(`${baseURL}/api/auth/callback/credentials`, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        form: {
          csrfToken,
          email,
          password,
          redirect: "false",
          json: "true",
          callbackUrl: `${baseURL}/app`,
        },
      })
      await page.goto("/app", { waitUntil: "domcontentloaded", timeout: 60_000 })
      await page.waitForURL(/\/app\/[^/]+/, { timeout: 30_000 })
      await context.storageState({ path: contextStatePath })
      fs.writeFileSync(statePath, JSON.stringify({ url: page.url() }, null, 2))
      console.log(`OK auth url=${page.url()} state=${contextStatePath}`)
    })
    return
  }

  if (action === "eval") {
    await withPage(async (page) => {
      if (fs.existsSync(statePath)) {
        const st = JSON.parse(fs.readFileSync(statePath, "utf8"))
        if (st.url) await page.goto(st.url, { waitUntil: "domcontentloaded" })
      }
      const result = await page.evaluate(args.js || args._[1])
      console.log(JSON.stringify(result))
    })
    return
  }

  usage()
  throw new Error(`unknown action: ${action}`)
}

main().catch((err) => {
  console.error(String(err?.stack || err))
  process.exit(1)
})
