import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";

<<<<<<< HEAD
=======
function getDatabaseUrl(): string {
  // If remote database URL is explicitly defined
  if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.startsWith("file:")
  ) {
    return process.env.DATABASE_URL;
  }

  // On Serverless / Vercel (Linux environments)
  if (
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NODE_ENV === "production"
  ) {
    try {
      const tmpDbPath = path.join("/tmp", "dev.db");

      // Possible locations of the bundled dev.db
      const possibleSources = [
        path.join(process.cwd(), "prisma", "dev.db"),
        path.join(process.cwd(), "dev.db"),
        path.join(__dirname, "..", "..", "..", "prisma", "dev.db"),
        path.join(__dirname, "prisma", "dev.db"),
      ];

      if (!fs.existsSync(tmpDbPath)) {
        for (const src of possibleSources) {
          if (fs.existsSync(src)) {
            try {
              fs.copyFileSync(src, tmpDbPath);
              break;
            } catch (err) {
              console.warn(`Could not copy SQLite file from ${src}:`, err);
            }
          }
        }
      }

      if (fs.existsSync(tmpDbPath)) {
        return `file:${tmpDbPath}`;
      }
    } catch (e) {
      console.warn("Vercel serverless /tmp db setup notice:", e);
    }
  }

  // Standard local SQLite path
  const localDb = path.join(process.cwd(), "prisma", "dev.db");
  return `file:${localDb.replace(/\\/g, "/")}`;
}

const dbUrl = getDatabaseUrl();
process.env.DATABASE_URL = dbUrl;

>>>>>>> parent of 678ac11 (Correções Gerais(Talvez sem banco de dados))
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

<<<<<<< HEAD
let prismaClient = globalForPrisma.prisma;
=======
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
>>>>>>> parent of 678ac11 (Correções Gerais(Talvez sem banco de dados))

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
