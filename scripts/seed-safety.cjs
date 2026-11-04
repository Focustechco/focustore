function assertDemoSeed() {
  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Demo seed disabled. Set ALLOW_DEMO_SEED=true only for an isolated local database.');
  }
}

module.exports = { assertDemoSeed };
