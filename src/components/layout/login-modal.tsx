'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, LockKeyhole, Mail, UserRound, X } from 'lucide-react';

export type CustomerSession = {
  id: string;
  name: string | null;
  email: string;
};

type LoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (user: CustomerSession) => void;
};

type AuthMode = 'login' | 'register';

export function LoginModal({ isOpen, onClose, onAuthenticated }: LoginModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setMounted(false);
      setVisible(false);
      return;
    }

    setMode('login');
    setShowPassword(false);
    setRemember(false);
    setError('');
    setNotice('');
    setName('');
    setEmail('');
    setCpf('');
    setIdentifier('');
    setPassword('');
    setPasswordConfirmation('');
    setMounted(true);
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  function closeModal() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setVisible(false);
    closeTimer.current = setTimeout(onClose, 200);
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeModal();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
    setNotice('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (mode === 'register' && password !== passwordConfirmation) {
      setError('As senhas não conferem.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'login'
            ? { identifier, password, remember }
            : { name, email, cpf, password },
        ),
      });
      const result = (await response.json()) as {
        user?: CustomerSession;
        error?: string;
      };

      if (!response.ok || !result.user) {
        setError(result.error || 'Não foi possível entrar. Tente novamente.');
        return;
      }

      onAuthenticated(result.user);
      closeModal();
    } catch (requestError) {
      console.error('Falha ao enviar formulário de autenticação:', requestError);
      setError('Não foi possível conectar. Verifique sua conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mounted) return null;

  const isRegistering = mode === 'register';

  return createPortal((
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <section
        aria-label="Área do cliente"
        aria-modal="true"
        className={`relative my-auto w-full max-w-[430px] rounded-2xl border border-[#222226] bg-[#121215] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.65)] transition duration-200 sm:p-8 ${
          visible ? 'scale-100' : 'scale-95'
        }`}
        role="dialog"
      >
        <button
          type="button"
          onClick={closeModal}
          aria-label="Fechar janela de login"
          className="absolute right-4 top-4 rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
        >
          <X size={19} />
        </button>

        <header className="mb-6 pr-8">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#FF5500]">
            Área do cliente
          </p>
        </header>

        <div className="mb-5 grid grid-cols-2 rounded-xl border border-[#222226] bg-[#09090b] p-1">
          <button
            type="button"
            onClick={() => changeMode('login')}
            aria-pressed={!isRegistering}
            className={`h-10 rounded-lg text-xs font-extrabold uppercase transition ${
              !isRegistering
                ? 'bg-[#FF5500] text-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => changeMode('register')}
            aria-pressed={isRegistering}
            className={`h-10 rounded-lg text-xs font-extrabold uppercase transition ${
              isRegistering
                ? 'bg-[#FF5500] text-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <>
              <div>
                <label
                  htmlFor="login-name"
                  className="mb-2 block text-xs font-bold uppercase text-zinc-300"
                >
                  Nome completo
                </label>
                <div className="relative">
                  <UserRound
                    aria-hidden="true"
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    id="login-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Seu nome"
                    className="h-11 w-full rounded-xl border border-[#222226] bg-[#09090b] pl-10 pr-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-[#FF5500]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-xs font-bold uppercase text-zinc-300"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seu@email.com"
                    className="h-11 w-full rounded-xl border border-[#222226] bg-[#09090b] pl-10 pr-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-[#FF5500]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-cpf"
                  className="mb-2 block text-xs font-bold uppercase text-zinc-300"
                >
                  CPF <span className="font-normal normal-case text-zinc-500"></span>
                </label>
                <input
                  id="login-cpf"
                  name="cpf"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={14}
                  value={cpf}
                  onChange={(event) => setCpf(event.target.value)}
                  placeholder="000.000.000-00"
                  className="h-11 w-full rounded-xl border border-[#222226] bg-[#09090b] px-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-[#FF5500]"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="login-identifier"
              className="mb-2 block text-xs font-bold uppercase text-zinc-300"
            >
              {isRegistering ? 'Senha' : 'E-mail'}
            </label>
            <div className="relative">
              {!isRegistering && (
                <Mail
                  aria-hidden="true"
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
              )}
              <input
                id="login-identifier"
                name={isRegistering ? 'password' : 'identifier'}
                type={isRegistering ? (showPassword ? 'text' : 'password') : 'text'}
                autoComplete={isRegistering ? 'new-password' : 'username'}
                minLength={isRegistering ? 8 : undefined}
                maxLength={72}
                required
                value={isRegistering ? password : identifier}
                onChange={(event) =>
                  isRegistering
                    ? setPassword(event.target.value)
                    : setIdentifier(event.target.value)
                }
                placeholder={isRegistering ? 'Mínimo de 8 caracteres' : 'seu@email.com'}
                className={`h-11 w-full rounded-xl border border-[#222226] bg-[#09090b] text-sm outline-none transition placeholder:text-zinc-600 focus:border-[#FF5500] ${
                  isRegistering ? 'pl-3 pr-11' : 'pl-10 pr-3'
                }`}
              />
              {isRegistering && (
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              )}
            </div>
          </div>

          {isRegistering ? (
            <div>
              <label
                htmlFor="login-password-confirm"
                className="mb-2 block text-xs font-bold uppercase text-zinc-300"
              >
                Confirmar senha
              </label>
              <div className="relative">
                <LockKeyhole
                  aria-hidden="true"
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  id="login-password-confirm"
                  name="passwordConfirmation"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  placeholder="Digite sua senha novamente"
                  className="h-11 w-full rounded-xl border border-[#222226] bg-[#09090b] pl-10 pr-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-[#FF5500]"
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="login-password"
                  className="text-xs font-bold uppercase text-zinc-300"
                >
                  Senha
                </label>
                <span className="text-xs font-medium text-zinc-500 text-">
                  Esqueceu a senha?
                </span>
              </div>
              <div className="relative">
                <LockKeyhole
                  aria-hidden="true"
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  maxLength={72}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Sua senha"
                  className="h-11 w-full rounded-xl border border-[#222226] bg-[#09090b] pl-10 pr-11 text-sm outline-none transition placeholder:text-zinc-600 focus:border-[#FF5500]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
          )}

          {!isRegistering && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-4 w-4 rounded border-[#222226] bg-[#09090b] accent-[#FF5500]"
              />
              Lembrar de mim
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-xl bg-[#FF5500] text-sm font-black uppercase text-black transition hover:bg-[#ff6b1a] focus:outline-none focus:ring-2 focus:ring-[#FF8A40] focus:ring-offset-2 focus:ring-offset-[#121215] disabled:cursor-wait disabled:opacity-70"
          >
            {isSubmitting
              ? 'Aguarde...'
              : isRegistering
                ? 'Criar conta'
                : 'Entrar na conta'}
          </button>
        </form>

        {!isRegistering && (
          <>
                <div className="my-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-[#222226]" />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#737987]">
                    Ou acesse com
                  </span>
                  <span className="h-px flex-1 bg-[#222226]" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={async (event) => {
                      if (isSubmitting) return;
                      const button = event.currentTarget;
                      button.disabled = true;
                      setIsSubmitting(true);
                      setNotice('');
                      let redirecting = false;
                      try {
                        const response = await fetch('/api/auth/social/google/start', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ returnTo: window.location.pathname + window.location.search }),
                        });
                        const result = await response.json() as { url?: string; error?: string };
                        if (!response.ok || !result.url) { setNotice(result.error || 'Não foi possível iniciar o login com Google.'); return; }
                        window.addEventListener('pageshow', () => { button.disabled = false; setIsSubmitting(false); }, { once: true });
                        window.location.assign(result.url);
                        redirecting = true;
                      } catch { setNotice('Não foi possível conectar ao login com Google. Tente novamente.'); }
                      finally { if (!redirecting) { button.disabled = false; setIsSubmitting(false); } }
                    }}
                    className="flex h-[50px] items-center justify-center gap-2 rounded-[14px] border border-[#222226] bg-[#1a1a1c] text-sm font-bold text-[#d4d5d9] transition hover:border-white/15 hover:bg-[#202023] focus:outline-none focus:ring-2 focus:ring-[#FF5500]"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[19px] w-[19px]">
                      <path fill="#4285F4" d="M21.6 12.23c0-.72-.06-1.42-.18-2.09H12v3.95h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
                      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.43l-3.23-2.52c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.6-4.13H3.06v2.6A10 10 0 0 0 12 22Z" />
                      <path fill="#FBBC05" d="M6.4 13.88a6.02 6.02 0 0 1 0-3.76V7.52H3.06a10 10 0 0 0 0 8.96l3.34-2.6Z" />
                      <path fill="#EA4335" d="M12 5.99c1.47 0 2.8.5 3.84 1.5l2.88-2.88C16.95 2.98 14.7 2 12 2a10 10 0 0 0-8.94 5.52l3.34 2.6c.8-2.37 3-4.13 5.6-4.13Z" />
                    </svg>
                    Google
                  </button>
                  <button
                    type="button"
                    onClick={async (event) => {
                      if (isSubmitting) return;
                      const button = event.currentTarget;
                      button.disabled = true;
                      setIsSubmitting(true);
                      setNotice('');
                      let redirecting = false;
                      try {
                        const response = await fetch('/api/auth/social/apple/start', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ returnTo: window.location.pathname + window.location.search }),
                        });
                        const result = await response.json() as { url?: string; error?: string };
                        if (!response.ok || !result.url) { setNotice(result.error || 'Não foi possível iniciar o login com Apple.'); return; }
                        window.addEventListener('pageshow', () => { button.disabled = false; setIsSubmitting(false); }, { once: true });
                        window.location.assign(result.url);
                        redirecting = true;
                      } catch { setNotice('Não foi possível conectar ao login com Apple. Tente novamente.'); }
                      finally { if (!redirecting) { button.disabled = false; setIsSubmitting(false); } }
                    }}
                    className="flex h-[50px] items-center justify-center gap-2 rounded-[14px] border border-[#222226] bg-[#1a1a1c] text-sm font-bold text-[#d4d5d9] transition hover:border-white/15 hover:bg-[#202023] focus:outline-none focus:ring-2 focus:ring-[#FF5500]"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[19px] w-[19px] fill-current">
                      <path d="M16.37 12.62c.02 2.1 1.84 2.8 1.86 2.81-.02.05-.29 1-.96 1.98-.58.85-1.18 1.7-2.13 1.72-.93.02-1.23-.55-2.3-.55-1.06 0-1.4.53-2.28.57-.91.04-1.6-.92-2.19-1.76-1.2-1.73-2.12-4.88-.89-7 .61-1.05 1.7-1.72 2.88-1.74.9-.02 1.75.61 2.3.61.55 0 1.58-.76 2.67-.65.46.02 1.76.19 2.59 1.43-.07.05-1.55.9-1.55 2.58ZM14.62 5.4c.48-.58.8-1.39.71-2.2-.69.03-1.52.46-2.02 1.03-.45.52-.84 1.34-.73 2.13.77.06 1.56-.39 2.04-.96Z" />
                    </svg>
                    Apple
                  </button>
                </div>
                {notice && (
                  <p role="status" className="mt-3 text-center text-xs text-zinc-400">
                    {notice}
                  </p>
                )}
          </>
        )}
        
      </section>
    </div>
  ), document.body);
}
