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

const staticRoutes: Record<string, (url: URL) => Promise<unknown>> = {
  '/api/overview': getOverviewMetrics,
  '/api/top-pages': getTopPages,
  '/api/referrers': getReferrers,
  '/api/sites': getSites,
  '/api/events': (url) => {
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    return getRecentEvents(limit);
  },
};

function matchDynamic(pathname: string): (() => Promise<unknown>) | undefined {
  const parts = pathname.split('/');
  const siteId = parts[3];
  if (!siteId || !pathname.startsWith('/api/sites/')) return undefined;

  if (parts[4] === 'traffic') return () => getSiteTraffic(siteId);
  if (!parts[4]) return () => getSiteDetail(siteId);
  return undefined;
}

/**
 * Handle API routes. Returns true if the request was handled.
 */
export async function apiRoutes(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const urlStr = req.url;
  if (!urlStr || !urlStr.startsWith('/api/')) return false;

  const url = new URL(urlStr, `http://${req.headers.host || 'localhost'}`);
  const handler = staticRoutes[url.pathname] ?? matchDynamic(url.pathname);
  if (!handler) return false;

  const data = await handler(url);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
  return true;
}
