import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { providerConfiguration, providerName } from '@/lib/auth/social/config';
import { startSocial } from '@/lib/auth/social/http';

export const runtime = 'nodejs';
async function start(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (provider !== 'google' && provider !== 'apple') return NextResponse.json({ error: 'Provedor inválido.' }, { status: 404 });
  return startSocial(request, providerName(provider), { db: prisma, configuration: providerConfiguration });
}
export { start as GET, start as POST };
