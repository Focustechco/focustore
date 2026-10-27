import { loadEnvConfig } from '@next/env';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { verifiedDatabaseUrl } from '../src/lib/db/database-url';
import { HIDDEN_PRODUCT_SLUGS } from '../src/modules/catalog/catalog-policy';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Este comando é exclusivo de desenvolvimento local.');
  const root = process.cwd();
  loadEnvConfig(root, true);
  const sourceUrl = verifiedDatabaseUrl(process.env, root);
  const source = sourceUrl.slice(5);
  const port = (name: string, fallback: number) => {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isInteger(value) || value < 1024 || value > 65535) throw new Error(`Porta inválida: ${name}`);
    return value;
  };
  const frontendPort = port('FOCUS_FRONTEND_PORT', 3000);
  const backendPort = port('FOCUS_BACKEND_PORT', 8000);
  if (frontendPort === backendPort) throw new Error('Frontend e backend precisam de portas distintas.');
  const localPython = path.join(root, 'backend', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const python = process.env.FOCUS_PYTHON_EXECUTABLE || (existsSync(localPython) ? localPython : 'python');
  if (!process.env.FOCUS_BACKEND_DATABASE_URL && !existsSync(path.join(root, 'backend', '.env'))) {
    throw new Error('Configure o PostgreSQL em backend/.env ou FOCUS_BACKEND_DATABASE_URL. Nenhuma migration será executada.');
  }

  const children: ChildProcess[] = [];
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    for (const child of children) {
      if (child.pid && child.exitCode === null) {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        } else child.kill('SIGTERM');
      }
    }
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const start = (command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) => {
    const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: 'inherit' });
    children.push(child);
    child.once('error', () => { console.error('Não foi possível iniciar um serviço local. Verifique Python e dependências.'); process.exitCode = 1; stop(); });
    child.once('exit', code => { if (!stopping) { process.exitCode = code || 1; stop(); } });
    return child;
  };

  const frontendEnv = { ...process.env, NODE_ENV: 'development', DATABASE_URL: sourceUrl } as NodeJS.ProcessEnv;
  delete frontendEnv.FOCUS_BACKEND_DATABASE_URL;
  const backendEnv = { ...process.env, LEGACY_CATALOG_SQLITE_PATH: source,
    LEGACY_CATALOG_EXCLUDED_SLUGS: JSON.stringify(HIDDEN_PRODUCT_SLUGS),
    APP_ENVIRONMENT: 'development', ALLOW_LOCAL_WRITES: 'false' } as NodeJS.ProcessEnv;
  // Never pass the frontend SQLite URL as SQLAlchemy's PostgreSQL DATABASE_URL.
  delete backendEnv.DATABASE_URL;
  delete backendEnv.NEXTAUTH_SECRET;
  if (process.env.FOCUS_BACKEND_DATABASE_URL) backendEnv.DATABASE_URL = process.env.FOCUS_BACKEND_DATABASE_URL;

  console.log(`Catálogo compartilhado (FastAPI somente leitura): ${source}`);
  console.log(`Next.js: http://127.0.0.1:${frontendPort} | FastAPI: http://127.0.0.1:${backendPort}/docs`);
  start(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(frontendPort)], root, frontendEnv);
  start(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(backendPort)], path.join(root, 'backend'), backendEnv);
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Falha na inicialização local.'); process.exitCode = 1; });
