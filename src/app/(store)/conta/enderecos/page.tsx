import Link from 'next/link';
import { ChevronRight, MapPin } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export default async function CustomerAddressesPage() {
  const customer = await getAuthenticatedUser();
  const addresses = customer
    ? await prisma.address.findMany({
        where: { userId: customer.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      })
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <nav className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
        <Link href="/" className="hover:text-white">Início</Link>
        <ChevronRight size={14} />
        <Link href="/conta" className="hover:text-white">Minha Conta</Link>
        <ChevronRight size={14} />
        <span className="font-semibold text-white">Endereços</span>
      </nav>

      <header className="border-b border-white/10 pb-4">
        <h1 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
          Meus Endereços
        </h1>
        <p className="mt-2 text-sm text-muted">
          Consulte os endereços associados à sua conta.
        </p>
      </header>

      {addresses.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <article
              key={address.id}
              className="rounded-2xl border border-white/10 bg-surface p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-focus/15 text-focus">
                    <MapPin size={19} />
                  </span>
                  <h2 className="text-sm font-bold text-white">
                    {address.recipientName}
                  </h2>
                </div>
                {address.isDefault && (
                  <span className="rounded-full bg-focus/15 px-2.5 py-1 text-[10px] font-bold uppercase text-focus">
                    Principal
                  </span>
                )}
              </div>
              <address className="space-y-1 text-sm not-italic text-muted">
                <p>
                  {address.street}, {address.number}
                  {address.complement ? ` - ${address.complement}` : ''}
                </p>
                <p>{address.neighborhood}</p>
                <p>{address.city} - {address.state}</p>
                <p>CEP: {address.postalCode}</p>
                {address.phone && <p>Telefone: {address.phone}</p>}
              </address>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-surface px-6 py-12 text-center text-sm text-muted">
          {customer
            ? 'Você ainda não tem endereços salvos.'
            : 'Entre na sua conta para consultar seus endereços salvos.'}
        </div>
      )}
    </div>
  );
}
