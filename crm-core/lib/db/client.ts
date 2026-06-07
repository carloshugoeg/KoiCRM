import "@/lib/startup-check";
import { PrismaClient } from "@prisma/client";
import { ensureAppRole, registerBasePrismaClient } from "@/lib/db/ensure-app-role";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  const base = new PrismaClient({
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
