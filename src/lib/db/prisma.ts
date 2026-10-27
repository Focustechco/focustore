import { PrismaClient } from "@prisma/client";
import { verifiedDatabaseUrl } from './database-url';

const dbUrl = verifiedDatabaseUrl(process.env);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
