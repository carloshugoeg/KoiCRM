import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

if (process.env.CI || process.env.VERCEL || process.env.HUSKY === "0") {
  process.exit(0);
}

if (!existsSync(".git")) {
  process.exit(0);
}

try {
  execSync("husky", { stdio: "inherit" });
} catch {
  process.exit(0);
}
