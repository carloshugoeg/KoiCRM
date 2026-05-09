import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    passWithNoTests: true,
    exclude: ["tests/integration/**", "node_modules/**"],
  },
  resolve: {
    alias: [{ find: /^@\/(.*)/, replacement: path.resolve(__dirname, "./$1") }],
  },
});
