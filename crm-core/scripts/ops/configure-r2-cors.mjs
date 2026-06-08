#!/usr/bin/env node
/**
 * Apply production CORS policy to the R2 bucket used by KoiCRM.
 *
 * Required env (from .env.local, .env.deploy.local, or shell):
 *   CLOUDFLARE_API_TOKEN  — Account → API Tokens → R2 Edit
 *   CLOUDFLARE_ACCOUNT_ID — or parse from S3_ENDPOINT
 *   S3_BUCKET             — default: aqua-crm
 *
 * Optional:
 *   R2_CORS_ORIGINS       — comma-separated extra origins to merge
 *
 * Usage:
 *   pnpm ops:configure-r2-cors
 *   R2_CORS_ORIGINS=https://preview.example.com pnpm ops:configure-r2-cors
 */
import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "../..")

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile(join(ROOT, ".env.local"))
loadEnvFile(join(ROOT, ".env.deploy.local"))

const token = process.env.CLOUDFLARE_API_TOKEN
const bucket = process.env.S3_BUCKET || "aqua-crm"
let accountId = process.env.CLOUDFLARE_ACCOUNT_ID

if (!accountId && process.env.S3_ENDPOINT) {
  const m = process.env.S3_ENDPOINT.match(
    /https:\/\/([a-f0-9]+)\.r2\.cloudflarestorage\.com/i,
  )
  if (m) accountId = m[1]
}

if (!token) {
  console.error("Missing CLOUDFLARE_API_TOKEN (R2 Edit permission).")
  process.exit(1)
}
if (!accountId) {
  console.error(
    "Missing CLOUDFLARE_ACCOUNT_ID — set it or provide S3_ENDPOINT with account id.",
  )
  process.exit(1)
}

const policyPath = join(__dirname, "r2-cors-production.json")
const policy = JSON.parse(readFileSync(policyPath, "utf8"))

const extraOrigins = (process.env.R2_CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

if (extraOrigins.length > 0) {
  const origins = new Set(policy.rules[0].allowed.origins)
  for (const o of extraOrigins) origins.add(o)
  policy.rules[0].allowed.origins = [...origins]
}

const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/cors`

const res = await fetch(url, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(policy),
})

const body = await res.json().catch(() => ({}))
if (!res.ok || body.success === false) {
  console.error("Failed to set R2 CORS policy:", JSON.stringify(body, null, 2))
  process.exit(1)
}

console.log(`OK: CORS applied to bucket "${bucket}"`)
console.log("Origins:", policy.rules[0].allowed.origins.join(", "))
