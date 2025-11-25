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
import { type IslandSSRService } from '../presets/island-ssr';

/**
 * Service factory type for SSR - matches the return type of createIslandSSRApi
 * User can wrap createIslandSSRApi to add extensions
 */
export type SSRServiceFactory<TService extends IslandSSRService = IslandSSRService> =
  () => TService;

/**
 * Options for createSSRHandler
 */
export interface SSRHandlerOptions<TService extends IslandSSRService> {
  /**
   * Service factory function
   * Pass createIslandSSRApi directly, or wrap it to add extensions:
   *
   * @example
   * // No extensions
   * createSSRHandler({ createService: createIslandSSRApi, ... })
   *
   * @example
   * // With extensions
   * const createMyService = () => {
   *   const base = createIslandSSRApi();
   *   return { ...base, svc: { ...base.svc, analytics: createAnalytics() } };
   * };
   * createSSRHandler({ createService: createMyService, ... })
   */
  createService: SSRServiceFactory<TService>;

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
export function createSSRHandler<TService extends IslandSSRService>(
  options: SSRHandlerOptions<TService>
): (req: IncomingMessage, res: ServerResponse) => void {
  const { createService, createApp, template } = options;

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
    const router = createRouter(
      svc as unknown as Parameters<typeof createRouter>[0],
      { initialPath: path }
    ) as unknown as Router<DOMServerRendererConfig>;

    // Create mount function
    const mount = <TElement>(spec: RefSpec<TElement>) => spec.create(svc);

    // Create the app with the router
    const App = createApp(router);

    // Render app to HTML within SSR context
    const html = runWithSSRContext(ssrCtx, () => {
      return renderToString(mount(App));
    });

    // Get island hydration scripts
    const scripts = getIslandScripts(ssrCtx);

    // Generate full HTML page
    const fullHtml = template(html, scripts);

    // Send response
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fullHtml);
  };
}
