import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function nextTestConfig(directory: string, dist: string): Promise<string> {
  const root = process.cwd();
  const original = JSON.parse(await readFile(path.join(root, 'tsconfig.json'), 'utf8'));
  const configPath = path.join(directory, 'tsconfig.next.json');
  // Next may update this file, so never point the isolated server at the developer's tsconfig.
  await writeFile(configPath, JSON.stringify({
    ...original,
    compilerOptions: { ...original.compilerOptions, baseUrl: path.relative(directory, root).replace(/\\/g, '/') || '.',
      tsBuildInfoFile: path.join(directory, 'next.tsbuildinfo') },
    include: ['next-env.d.ts', 'src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts', 'scripts/**/*.ts',
      'prisma/**/*.ts', 'next.config.ts', 'tailwind.config.ts'].map(pattern => path.join(root, pattern).replace(/\\/g, '/'))
      .concat([path.join(root, dist, 'types/**/*.ts'), path.join(root, dist, 'dev/types/**/*.ts')].map(value => value.replace(/\\/g, '/'))),
    exclude: [path.join(root, 'node_modules').replace(/\\/g, '/')],
  }, null, 2));
  return path.relative(root, configPath).replace(/\\/g, '/');
}
