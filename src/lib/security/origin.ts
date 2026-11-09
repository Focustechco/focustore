export type OriginCheck = {
  allowed: boolean;
  receivedOrigin: string | null;
  requestOrigin: string | null;
  expectedOrigin: string | null;
};

function parseOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function localOriginAliases(origin: string): string[] {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(parsed.hostname)) return [];
    const alias = parsed.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    return [`http://${alias}${parsed.port ? `:${parsed.port}` : ''}`];
  } catch {
    return [];
  }
}

function configuredOrigins(): string[] {
  return [
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.FOCUS_ALLOWED_ORIGINS?.split(',') ?? []),
  ].flatMap((value) => {
    const parsed = parseOrigin(value?.trim());
    return parsed ? [parsed] : [];
  });
}

export function checkOrigin(request: Request): OriginCheck {
  const receivedOrigin = parseOrigin(request.headers.get('origin'));
  const requestOrigin = parseOrigin(request.url);
  const configured = configuredOrigins();
  const configuredOrigin = configured[0] ?? null;
  const allowed = new Set<string>();
  if (requestOrigin) allowed.add(requestOrigin);
  configured.forEach((origin) => allowed.add(origin));
  if (process.env.NODE_ENV !== 'production') {
    if (requestOrigin) localOriginAliases(requestOrigin).forEach((origin) => allowed.add(origin));
    configured.forEach((origin) => localOriginAliases(origin).forEach((alias) => allowed.add(alias)));
  }

  return {
    allowed: receivedOrigin !== null && allowed.has(receivedOrigin),
    receivedOrigin,
    requestOrigin,
    expectedOrigin: configuredOrigin || requestOrigin,
  };
}

export function sameOrigin(request: Request): boolean {
  return checkOrigin(request).allowed;
}
