import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prismaAdmin: PrismaClient | undefined }

/** Placeholder only while Next collects page data; never used to open a real connection. */
const BUILD_PLACEHOLDER_URL = "postgresql://build:build@127.0.0.1:5432/build"

function createPrismaAdmin(): PrismaClient {
  const url = process.env.DATABASE_ADMIN_URL
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build"

  // Passing `datasources.db.url: undefined` throws PrismaClientConstructorValidationError
  // during `next build` when Preview env vars are absent (Production-only on Vercel).
  if (!url && !isBuildPhase) {
    throw new Error(
      "[db/admin] DATABASE_ADMIN_URL is required outside the Next.js production-build phase."
    )
  }

  return new PrismaClient({
    datasources: { db: { url: url ?? BUILD_PLACEHOLDER_URL } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

/** Admin DB client (BYPASSRLS). Use only for migrations, seeds, and tenant bootstrap. */
export const prismaAdmin = globalForPrisma.prismaAdmin ?? createPrismaAdmin()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaAdmin = prismaAdmin
}
