import "@/lib/startup-check";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

/** Singleton — reinicia `next dev` tras `prisma generate` o migraciones nuevas. */
export const prisma = (globalForPrisma.prisma ??= createPrismaClient());
