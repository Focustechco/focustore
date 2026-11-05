function assertDemoSeed(env = process.env) {
  if (env.FOCUS_ALLOW_DEMO_SEED !== '1') {
    throw new Error('Semente de demonstração bloqueada. Defina FOCUS_ALLOW_DEMO_SEED=1 após confirmar o banco de destino.');
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('Sementes de demonstração não podem ser executadas em produção.');
  }

  const databaseUrl = env.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || !databaseUrl) {
    throw new Error('Configure explicitamente um banco local ou descartável antes de executar a semente.');
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL inválida; semente bloqueada.');
  }

  if (
    parsed.protocol === 'file:' &&
    (!parsed.hostname || parsed.hostname === 'localhost')
  ) {
    return;
  }

  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (
    (parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:') &&
    isLoopback &&
    databaseName.endsWith('_test')
  ) {
    return;
  }

  throw new Error('Semente de demonstração permitida somente em SQLite local ou PostgreSQL loopback *_test.');
}

module.exports = { assertDemoSeed };
