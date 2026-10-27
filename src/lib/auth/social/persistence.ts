import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { SocialLoginError, type Provider } from './config';
import type { SocialFlow } from './flow';

export type SocialIdentity = { sub: string; email?: string; emailVerified: boolean; name?: string };

export async function persistIdentity(db: PrismaClient, provider: Provider, identity: SocialIdentity, flow: SocialFlow) {
  if (!identity.sub || identity.sub.length > 255) throw new SocialLoginError('identity_invalid');
  const sessionToken = randomBytes(32).toString('hex');
  const maxAge = 86400;
  const save = () => db.$transaction(async tx => {
    if (flow.linkUserId) {
      if (!flow.linkSession) throw new SocialLoginError('link_denied', 403);
      const session = await tx.session.findUnique({ where: { sessionToken: flow.linkSession } });
      if (!session || session.userId !== flow.linkUserId || session.expires <= new Date()) {
        throw new SocialLoginError('link_denied', 403);
      }
    }
    const account = await tx.account.findUnique({ where: {
      provider_providerAccountId: { provider, providerAccountId: identity.sub },
    } });
    let userId: string;
    if (account) {
      if (flow.linkUserId && flow.linkUserId !== account.userId) throw new SocialLoginError('account_in_use', 409);
      userId = account.userId;
    } else if (flow.linkUserId) {
      userId = flow.linkUserId;
      await tx.account.create({ data: { userId, provider, providerAccountId: identity.sub, type: 'oidc' } });
    } else {
      if (!identity.emailVerified || !identity.email || !z.email().max(254).safeParse(identity.email).success) {
        throw new SocialLoginError('verified_email_required', 403);
      }
      const email = identity.email.toLowerCase();
      // SQLite uniqueness is case-sensitive: also protect existing legacy mixed-case emails.
      const collisions = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1`;
      if (collisions.length) throw new SocialLoginError('account_link_required', 409);
      const user = await tx.user.create({ data: {
        email, name: identity.name?.slice(0, 100) || null, emailVerified: new Date(), role: 'CUSTOMER',
        accounts: { create: { provider, providerAccountId: identity.sub, type: 'oidc' } },
      }, select: { id: true } });
      userId = user.id;
    }
    await tx.session.create({ data: { sessionToken, userId, expires: new Date(Date.now() + maxAge * 1000) } });
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true } });
    return { user, sessionToken, maxAge };
  });
  try { return await save(); }
  catch (error) {
    // A simultaneous first login may already have committed the same provider/sub.
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
      const existing = await db.account.findUnique({ where: { provider_providerAccountId: { provider, providerAccountId: identity.sub } } });
      if (existing) return save();
      throw new SocialLoginError('account_link_required', 409);
    }
    throw error;
  }
}
