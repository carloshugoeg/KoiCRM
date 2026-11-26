import "@/lib/startup-check";
import { PrismaClient } from "@prisma/client";
import { ensureAppRole, registerBasePrismaClient } from "@/lib/db/ensure-app-role";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/** Placeholder only while Next collects page data; never used to open a real connection. */
const BUILD_PLACEHOLDER_URL = "postgresql://build:build@127.0.0.1:5432/build";

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  // Preview builds on Vercel often lack DATABASE_* (Production-only envs). Prisma still
  // constructs the client while collecting page data; a placeholder keeps the build green.
  const base = new PrismaClient({
    ...(url || isBuildPhase
      ? { datasources: { db: { url: url ?? BUILD_PLACEHOLDER_URL } } }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
  registerBasePrismaClient(base);

  if (process.env.DATABASE_SET_ROLE !== "app_user") {
    return base;
  }

  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        await ensureAppRole();
        return query(args);
      },
    },
  }) as unknown as PrismaClient;
}

/** Singleton — reinicia `next dev` tras `prisma generate` o migraciones nuevas. */
export const prisma = (globalForPrisma.prisma ??= createPrismaClient());
