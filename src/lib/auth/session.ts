import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';

export const AUTH_COOKIE_NAME = 'focus_session';

export type AuthenticatedUser = {
  id: string;
  name: string | null;
  email: string;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!sessionToken) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken },
    select: {
      expires: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!session || session.expires <= new Date()) return null;

  return session.user;
}
