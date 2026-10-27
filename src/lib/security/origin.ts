export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  return !origin || origin === new URL(request.url).origin;
}
