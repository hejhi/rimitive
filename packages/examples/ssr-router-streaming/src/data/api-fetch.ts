/**
 * Helper to make fetch work with relative URLs on both client and server.
 * Node.js fetch requires absolute URLs, so we prepend the base on the server.
 */
const BASE_URL = typeof window === 'undefined' ? 'http://localhost:3000' : '';

export function apiFetch(path: string): Promise<Response> {
  const url = path.startsWith('/') ? `${BASE_URL}${path}` : path;
  return fetch(url);
}
