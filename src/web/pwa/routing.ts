export function shouldUseCache(request: Request, base: URL): boolean {
  const url = new URL(request.url);
  // Release staging explicitly fetches fresh bytes before verifying against the candidate digest.
  return (
    request.method === 'GET' &&
    (request.cache !== 'no-store' || request.mode === 'navigate') &&
    url.origin === base.origin &&
    url.pathname.startsWith(base.pathname) &&
    url.pathname !== new URL('web-manifest.json', base).pathname
  );
}
