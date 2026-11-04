export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const source = origin || referer;

  if (!source || source === 'null') return false;

  try {
    return new URL(source).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
