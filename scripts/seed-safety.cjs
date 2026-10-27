function assertDemoSeed() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.FOCUS_ALLOW_DEMO_SEED !== 'true' ||
      !/^file:.*(?:_demo|_test)\.db$/.test(process.env.DATABASE_URL || '')) {
    throw new Error('Seed permitido apenas com FOCUS_ALLOW_DEMO_SEED=true e DATABASE_URL SQLite explícita terminada em _demo.db ou _test.db, fora de produção.');
  }
}

function requiredSeedPassword(name) {
  const password = process.env[name];
  if (!password || Buffer.byteLength(password) < 12 || Buffer.byteLength(password) > 72) {
    throw new Error('Configure senhas de seed de 12 a 72 bytes no ambiente.');
  }
  return password;
}

module.exports = { assertDemoSeed, requiredSeedPassword };
