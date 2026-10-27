import path from 'node:path';
import { closeSync, fstatSync, openSync, readSync, realpathSync } from 'node:fs';

export function databaseUrl(env: Readonly<Record<string, string | undefined>>, cwd = process.cwd()): string {
  const configured = env.DATABASE_URL;
  if (!configured) {
    throw new Error('Configure DATABASE_URL explicitamente para um SQLite existente. Nenhum banco foi criado.');
  }
  if (!configured.startsWith('file:')) {
    throw new Error('O schema Prisma atual exige uma URL SQLite file:.');
  }
  const filename = configured.slice(5);
  if (!filename || filename.includes('?') || filename.includes('#')) {
    throw new Error('DATABASE_URL SQLite inválida.');
  }
  const resolved = path.isAbsolute(filename) ? filename : path.resolve(cwd, 'prisma', filename);
  if ((env.NODE_ENV === 'production' || env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME) &&
      /^\/tmp(?:\/|$)/.test(resolved.replace(/\\/g, '/'))) {
    throw new Error('SQLite temporário não pode armazenar dados de produção.');
  }
  return `file:${resolved.replace(/\\/g, '/')}`;
}

export function verifiedDatabaseUrl(env: Readonly<Record<string, string | undefined>>, cwd = process.cwd()): string {
  const url = databaseUrl(env, cwd);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(url.slice(5), 'r');
    if (!fstatSync(descriptor).isFile() || fstatSync(descriptor).size < 100) throw new Error('Invalid SQLite');
    const header = Buffer.alloc(16);
    if (readSync(descriptor, header, 0, header.length, 0) !== 16 || !header.equals(Buffer.from('SQLite format 3\0'))) {
      throw new Error('Invalid SQLite');
    }
    return `file:${realpathSync(url.slice(5)).replace(/\\/g, '/')}`;
  } catch {
    throw new Error('SQLite configurado ausente, inacessível ou inválido. Confira DATABASE_URL; não foi criado um banco vazio.');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
