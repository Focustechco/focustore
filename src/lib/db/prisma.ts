import { PrismaClient } from "@prisma/client";
<<<<<<< HEAD

import { verifiedDatabaseUrl } from "@/lib/db/database-url";

=======
import { verifiedDatabaseUrl } from "./database-url";

>>>>>>> 680d9dc25669bd21e8f25939cde9c657f998fb71
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

<<<<<<< HEAD
function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const client = new PrismaClient({
    datasources: {
      db: {
        url: verifiedDatabaseUrl(process.env),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
=======
let prismaClient = globalForPrisma.prisma;
>>>>>>> 680d9dc25669bd21e8f25939cde9c657f998fb71

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client) as unknown;
<<<<<<< HEAD

=======
>>>>>>> 680d9dc25669bd21e8f25939cde9c657f998fb71
    return typeof value === "function" ? value.bind(client) : value;
  },
});
