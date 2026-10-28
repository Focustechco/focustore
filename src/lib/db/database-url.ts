export function databaseUrl(env: Readonly<Record<string, string | undefined>>): string {
  const configured = env.DATABASE_URL;
  if (!configured) {
    throw new Error('Configure DATABASE_URL explicitamente com PostgreSQL persistente.');
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error('DATABASE_URL inválida. Use uma URL PostgreSQL postgresql:// ou postgres://.');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('DATABASE_URL deve usar PostgreSQL (postgresql:// ou postgres://).');
  }
  if (!parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
    throw new Error('DATABASE_URL PostgreSQL deve informar host e banco de dados.');
  }
  return configured;
}

export const verifiedDatabaseUrl = databaseUrl;
