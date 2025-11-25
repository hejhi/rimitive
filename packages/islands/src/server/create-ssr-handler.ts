/**
 * SSR Handler Factory
 *
 * Creates an HTTP request handler for server-side rendering.
 * Handles per-request service instantiation, routing, and HTML generation.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRouter, type Router } from '@lattice/router';
import type { RefSpec } from '@lattice/view/types';
import { type DOMServerRendererConfig } from '../renderers/dom-server';
import {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '../ssr-context';
import { renderToString } from '../helpers/renderToString';
import { type ServiceResult } from '../types';

/**
 * Service factory type for SSR
 *
 * Called per-request to get fresh services (avoids state leakage).
 * Returns at minimum { svc }.
 */
export type SSRServiceFactory<TSvc = Record<string, unknown>> =
  () => ServiceResult<TSvc>;

/**
 * Options for createSSRHandler
 */
export interface SSRHandlerOptions<TSvc = Record<string, unknown>> {
  /**
   * Service factory function
   * Called per-request to get fresh services.
   */
  createService: SSRServiceFactory<TSvc>;

  /**
   * Function that creates the app given a router
   * Called per-request with a fresh router instance
   */
  createApp: (router: Router<DOMServerRendererConfig>) => RefSpec<unknown>;

  /**
   * HTML template function
   * Receives rendered content and island scripts, returns full HTML
   */
  template: (content: string, scripts: string) => string;
}

/**
 * Create an SSR request handler
 *
 * Returns a function that handles HTTP requests by:
 * 1. Calling the service factory per-request (fresh signals)
 * 2. Creating a router with the request path
 * 3. Rendering the app to HTML
 * 4. Returning the complete HTML page with island scripts
 */
export function createSSRHandler<TSvc = Record<string, unknown>>({
  createService,
  createApp,
  template,
}: SSRHandlerOptions<TSvc>): (
  req: IncomingMessage,
  res: ServerResponse
) => void {
  return (req: IncomingMessage, res: ServerResponse) => {
    // Parse URL path
    const url = new URL(
      req.url || '/',
      `http://${req.headers.host || 'localhost'}`
    );
    const path = url.pathname;

    // Create SSR context for islands
    const ssrCtx = createSSRContext();

    // Create per-request service (fresh signals per request)
    const { svc } = createService();

    // Create router with service
    const router = createRouter(svc as Parameters<typeof createRouter>[0], {
      initialPath: path,
    }) as unknown as Router<DOMServerRendererConfig>;

    // Create mount function
    const mount = <TElement>(spec: RefSpec<TElement>) => spec.create(svc);

    // Create the app with the router
    const App = createApp(router);

    // Render app to HTML within SSR context
    const html = runWithSSRContext(ssrCtx, () => renderToString(mount(App)));

    // Get island hydration scripts
    const scripts = getIslandScripts(ssrCtx);

    // Generate full HTML page
    const fullHtml = template(html, scripts);

    // Send response
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fullHtml);
  };
}
