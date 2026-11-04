'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LockKeyhole, Mail } from 'lucide-react';

export default function AdminAccessPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, adminOnly: true }),
      });
      const result = (await response.json()) as {
        user?: { role: string };
        error?: string;
      };

      if (!response.ok || !result.user) {
        setError(result.error || 'Não foi possível entrar no painel.');
        return;
      }

      router.replace('/admin/dashboard');
      router.refresh();
    } catch (requestError) {
      console.error('Falha ao autenticar no painel administrativo:', requestError);
      setError('Não foi possível conectar. Verifique sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121215] p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#FF5500]">
          Focus Store
        </p>
        <h1 className="mt-2 text-2xl font-black uppercase tracking-tight">
          Acesso administrativo
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Entre com uma conta de administrador ou gerente para acessar o painel.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label htmlFor="admin-identifier" className="mb-2 block text-xs font-bold uppercase text-zinc-300">
              E-mail ou CPF
            </label>
            <div className="relative">
              <Mail aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                id="admin-identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#222226] bg-[#09090b] pl-10 pr-3 text-sm outline-none transition focus:border-[#FF5500]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-2 block text-xs font-bold uppercase text-zinc-300">
              Senha
            </label>
            <div className="relative">
              <LockKeyhole aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#222226] bg-[#09090b] pl-10 pr-3 text-sm outline-none transition focus:border-[#FF5500]"
              />
            </div>
          </div>

          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="h-12 w-full rounded-xl bg-[#FF5500] text-sm font-black uppercase text-black transition hover:bg-[#ff6b1a] disabled:cursor-wait disabled:opacity-70"
          >
            {submitting ? 'Verificando...' : 'Entrar no painel'}
          </button>
        </form>

        <Link href="/" className="mt-5 block text-center text-sm text-zinc-400 transition hover:text-white">
          Voltar à loja
        </Link>
      </section>
    </main>
  );
}
