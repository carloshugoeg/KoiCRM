import { defineConfig } from "vitest/config";
import path from "path";
import { readFileSync } from "fs";

// Manually load .env for forks pool (which doesn't inherit vitest's env loading)
try {
  const envFile = readFileSync(path.resolve(__dirname, ".env"), "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch {
  // .env not present, rely on environment variables being set externally
}

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: "forks",
    fileParallelism: false,
  },
  resolve: {
    alias: [{ find: /^@\/(.*)/, replacement: path.resolve(__dirname, "./$1") }],
  },
});
