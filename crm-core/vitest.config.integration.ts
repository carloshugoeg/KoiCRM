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
    alias: [
      // `server-only` throws under the node runner (no react-server condition);
      // stub it so modules that import it (lib/auth/*) can load in tests.
      { find: /^server-only$/, replacement: path.resolve(__dirname, "./tests/integration/server-only-stub.ts") },
      // `next/headers` cookies()/headers() require a request scope; give the node
      // runner an in-memory stub so action tests can run the PIN gate.
      { find: /^next\/headers$/, replacement: path.resolve(__dirname, "./tests/integration/next-headers-stub.ts") },
      { find: /^@\/(.*)/, replacement: path.resolve(__dirname, "./$1") },
    ],
  },
});
