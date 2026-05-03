import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: "forks",
    singleFork: true,
    fileParallelism: false,
  },
  resolve: {
    alias: [{ find: /^@\/(.*)/, replacement: path.resolve(__dirname, "./$1") }],
  },
});
