import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prismaAdmin: PrismaClient | undefined }

/** Admin DB client (BYPASSRLS). Use only for migrations, seeds, and tenant bootstrap. */
export const prismaAdmin =
  globalForPrisma.prismaAdmin ??
  new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_ADMIN_URL } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaAdmin = prismaAdmin
}
