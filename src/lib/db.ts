import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Force recreate PrismaClient if it doesn't have the Route model
// (can happen after schema changes when the dev server hot-reloads)
if (globalForPrisma.prisma && !(globalForPrisma.prisma as any).route) {
  globalForPrisma.prisma = undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
