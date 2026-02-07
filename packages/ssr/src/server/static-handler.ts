/// <reference types="node" />
/**
 * Static File Handler
 *
 * Serves static assets (JavaScript bundles, lazy-loaded chunks) from a
 * directory. Returns `true` if the request was handled, `false` otherwise.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Configuration for the static file handler.
 */
export type StaticHandlerConfig = {
  /** Directory containing built client assets */
  clientDir: string;
  /** URL patterns to serve (e.g., ['/client.js', '/assets/']) */
  urlPatterns: string[];
};

/**
 * A handler function that serves static assets.
 * Returns `true` if the request was handled, `false` if it should be passed on.
 */
export type StaticHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => boolean;

/**
 * Create a handler that serves static assets from a directory.
 *
 * Matches request URLs against the configured patterns. Exact matches
 * (e.g., `/client.js`) serve the file directly. Prefix matches (ending
 * with `/`, e.g., `/assets/`) serve files relative to the client directory.
 *
 * @example
 * ```ts
 * const serveStatic = createStaticHandler({
 *   clientDir: join(__dirname, '../dist/client'),
 *   urlPatterns: ['/client.js', '/assets/'],
 * });
 *
 * const server = createServer((req, res) => {
 *   if (serveStatic(req, res)) return;
 *   // ... handle other routes
 * });
 * ```
 */
export function createStaticHandler(config: StaticHandlerConfig): StaticHandler {
  const { clientDir, urlPatterns } = config;
  const clientBundlePath = join(clientDir, 'client.js');

  return (req, res) => {
    const url = req.url;
    if (!url) return false;

    const matches = urlPatterns.some(
      (pattern) =>
        url === pattern || (pattern.endsWith('/') && url.startsWith(pattern)),
    );

    if (!matches) return false;

    const filePath =
      url === '/client.js' ? clientBundlePath : join(clientDir, url);

    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(content);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }

    return true;
  };
}
