import { writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Create a new database in a freshly-created test directory. */
export async function sqliteTestUrl(directory: string): Promise<string> {
  const database = path.join(directory, 'store.db');
  await writeFile(database, '', { flag: 'wx' });
  return `file:${database.replace(/\\/g, '/')}`;
}
