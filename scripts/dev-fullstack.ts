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
  const frontendDatabaseUrl = verifiedDatabaseUrl(process.env);
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
  process.once('SIGINT', () => { stop(); setTimeout(() => process.exit(130), 2000).unref(); });
  process.once('SIGTERM', () => { stop(); setTimeout(() => process.exit(143), 2000).unref(); });
  const start = (command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) => {
    const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: 'inherit' });
    children.push(child);
    child.once('error', error => {
      console.error(`Não foi possível iniciar ${command}: ${error.message}`);
      process.exitCode = 1;
      stop();
    });
    child.once('exit', (code, signal) => {
      if (!stopping) {
        console.error(`${command} encerrou inesperadamente (código ${code ?? 'n/a'}, sinal ${signal ?? 'n/a'}).`);
        process.exitCode = code || 1;
        stop();
      }
    });
    return child;
  };

  async function waitForHttp(url: string, child: ChildProcess, label: string): Promise<void> {
    const deadline = Date.now() + 30_000;
    let lastError = 'sem resposta';
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`${label} encerrou antes de ficar disponível.`);
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
        if (response.ok) return;
        lastError = `HTTP ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'erro de conexão';
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`${label} não respondeu HTTP 200 em 30 segundos (${lastError}).`);
  }

  const frontendEnv = { ...process.env, NODE_ENV: 'development', DATABASE_URL: frontendDatabaseUrl } as NodeJS.ProcessEnv;
  delete frontendEnv.FOCUS_BACKEND_DATABASE_URL;
  const backendEnv = { ...process.env,
    LEGACY_CATALOG_EXCLUDED_SLUGS: JSON.stringify(HIDDEN_PRODUCT_SLUGS),
    APP_ENVIRONMENT: 'development', ALLOW_LOCAL_WRITES: 'false' } as NodeJS.ProcessEnv;
  // Never pass the frontend Prisma URL as SQLAlchemy's PostgreSQL DATABASE_URL.
  delete backendEnv.DATABASE_URL;
  delete backendEnv.NEXTAUTH_SECRET;
  if (process.env.LEGACY_CATALOG_SQLITE_PATH) {
    backendEnv.LEGACY_CATALOG_SQLITE_PATH = process.env.LEGACY_CATALOG_SQLITE_PATH;
  } else {
    delete backendEnv.LEGACY_CATALOG_SQLITE_PATH;
  }
  if (process.env.FOCUS_BACKEND_DATABASE_URL) backendEnv.DATABASE_URL = process.env.FOCUS_BACKEND_DATABASE_URL;

  const frontendDatabaseKind = frontendDatabaseUrl.startsWith('file:') ? 'SQLite legado' : 'PostgreSQL';
  console.log(`Frontend Prisma: ${frontendDatabaseKind} | FastAPI: PostgreSQL próprio${backendEnv.LEGACY_CATALOG_SQLITE_PATH ? ' + catálogo SQLite legado somente leitura' : ''}`);
  console.log(`Next.js: http://127.0.0.1:${frontendPort} | FastAPI: http://127.0.0.1:${backendPort}/docs`);
  const frontend = start(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(frontendPort)], root, frontendEnv);
  const backend = start(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(backendPort)], path.join(root, 'backend'), backendEnv);
  try {
    await Promise.all([
      waitForHttp(`http://127.0.0.1:${backendPort}/health`, backend, 'FastAPI'),
      waitForHttp(`http://127.0.0.1:${frontendPort}`, frontend, 'Next.js'),
    ]);
    console.log('FocusStore local disponível: FastAPI /health e Next.js responderam HTTP 200.');
  } catch (error) {
    stop();
    throw error;
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Falha na inicialização local.'); process.exitCode = 1; });
