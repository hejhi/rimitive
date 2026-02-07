/**
 * API Route Configuration
 *
 * Declarative API route handlers for the analytics dashboard.
 * Each route maps a URL pattern to a data fetcher.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  getOverviewMetrics,
  getTopPages,
  getReferrers,
} from './data/api-metrics.js';
import { getSiteDetail, getSiteTraffic, getSites } from './data/api-sites.js';
import { getRecentEvents } from './data/api-events.js';

type RouteHandler = (
  url: URL,
) => Promise<unknown> | undefined;

/**
 * Route definitions: [matcher, handler] pairs.
 * Matchers return a handler if the URL matches, undefined otherwise.
 */
const routes: Array<(url: URL) => RouteHandler | undefined> = [
  (url) => url.pathname === '/api/overview' ? () => getOverviewMetrics() : undefined,
  (url) => url.pathname === '/api/top-pages' ? () => getTopPages() : undefined,
  (url) => url.pathname === '/api/referrers' ? () => getReferrers() : undefined,
  (url) => url.pathname === '/api/sites' ? () => getSites() : undefined,
  (url) => {
    if (url.pathname.startsWith('/api/sites/') && !url.pathname.endsWith('/traffic')) {
      const siteId = url.pathname.split('/')[3];
      if (siteId) return () => getSiteDetail(siteId);
    }
    return undefined;
  },
  (url) => {
    if (url.pathname.includes('/api/sites/') && url.pathname.endsWith('/traffic')) {
      const siteId = url.pathname.split('/')[3];
      if (siteId) return () => getSiteTraffic(siteId);
    }
    return undefined;
  },
  (url) => {
    if (url.pathname === '/api/events') {
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      return () => getRecentEvents(limit);
    }
    return undefined;
  },
];

/**
 * Handle API routes. Returns true if the request was handled.
 */
export async function apiRoutes(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const urlStr = req.url;
  if (!urlStr || !urlStr.startsWith('/api/')) return false;

  const url = new URL(urlStr, `http://${req.headers.host || 'localhost'}`);

  for (const match of routes) {
    const handler = match(url);
    if (handler) {
      const data = await handler(url);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return true;
    }
  }

  return false;
}
