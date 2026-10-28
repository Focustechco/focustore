import { PrismaClient } from "@prisma/client";
import { verifiedDatabaseUrl } from './database-url';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaClient = globalForPrisma.prisma;

function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    const dbUrl = verifiedDatabaseUrl(process.env);
    prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log: [],
    });

    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaClient;
  }

  return prismaClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client) as unknown;
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
