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

export function checkOrigin(request: Request): OriginCheck {
  const receivedOrigin = parseOrigin(request.headers.get('origin'));
  const requestOrigin = parseOrigin(request.url);
  const configuredOrigin = parseOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const allowed = new Set<string>();
  if (requestOrigin) allowed.add(requestOrigin);
  if (configuredOrigin) allowed.add(configuredOrigin);
  if (process.env.NODE_ENV !== 'production') {
    if (requestOrigin) localOriginAliases(requestOrigin).forEach((origin) => allowed.add(origin));
    if (configuredOrigin) localOriginAliases(configuredOrigin).forEach((origin) => allowed.add(origin));
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
