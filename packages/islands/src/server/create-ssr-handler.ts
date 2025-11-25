/**
 * SSR Handler Factory
 *
 * Creates an HTTP request handler for server-side rendering.
 * Handles per-request service instantiation, routing, and HTML generation.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { composeFrom } from '@lattice/lattice';
import { createSignalsApi } from '@lattice/signals/presets/core';
import {
  defaultExtensions as defaultViewExtensions,
  defaultHelpers as defaultViewHelpers,
} from '@lattice/view/presets/core';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { createRouter, type Router } from '@lattice/router';
import type { RefSpec } from '@lattice/view/types';
import {
  createDOMServerRenderer,
  type DOMServerRendererConfig,
} from '../renderers/dom-server';
import {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '../ssr-context';
import { renderToString } from '../helpers/renderToString';
import type { ServiceDescriptor } from '../service/types';
import type { BaseService } from '../service/define-service';

/**
 * Options for createSSRHandler
 */
export interface SSRHandlerOptions<TService> {
  /**
   * Service descriptor from defineService()
   */
  service: ServiceDescriptor<TService>;

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
 * Create base service for server-side rendering
 *
 * Creates signals + view services with the linkedom renderer.
 * Called per-request to ensure isolation.
 */
function createServerBaseService(): BaseService {
  const signals = createSignalsApi();
  const renderer = createDOMServerRenderer();
  const viewHelpers = defaultViewHelpers(renderer, signals);
  const views = composeFrom(defaultViewExtensions<DOMServerRendererConfig>(), viewHelpers);

  return {
    ...signals,
    ...views,
  };
}

/**
 * Create an SSR request handler
 *
 * Returns a function that handles HTTP requests by:
 * 1. Creating per-request services using the service descriptor
 * 2. Creating a router with the request path
 * 3. Rendering the app to HTML
 * 4. Returning the complete HTML page with island scripts
 *
 * @param options - Handler configuration
 * @returns HTTP request handler function
 *
 * @example
 * ```ts
 * import { createServer } from 'node:http';
 * import { createSSRHandler } from '@lattice/islands/server';
 * import { service } from './service.js';
 * import { createApp } from './routes.js';
 *
 * const handler = createSSRHandler({
 *   service,
 *   createApp,
 *   template: (content, scripts) => `
 *     <!DOCTYPE html>
 *     <html>
 *       <head><title>My App</title></head>
 *       <body>
 *         ${content}
 *         ${scripts}
 *         <script type="module" src="/client.js"></script>
 *       </body>
 *     </html>
 *   `,
 * });
 *
 * createServer(handler).listen(3000);
 * ```
 */
export function createSSRHandler<TService>(
  options: SSRHandlerOptions<TService>
): (req: IncomingMessage, res: ServerResponse) => void {
  const { service, createApp, template } = options;

  return (req: IncomingMessage, res: ServerResponse) => {
    // Parse URL path
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;

    // Create SSR context for islands
    const ssrCtx = createSSRContext();

    // Create per-request base service
    const base = createServerBaseService();

    // Apply user's extensions
    const svc = service.extend(base);

    // Add addEventListener helper (common need)
    const fullSvc = {
      ...svc,
      addEventListener: createAddEventListener((base as { batch: <T>(fn: () => T) => T }).batch),
    };

    // Create router with full service
    const router = createRouter(
      fullSvc as unknown as Parameters<typeof createRouter>[0],
      { initialPath: path }
    ) as unknown as Router<DOMServerRendererConfig>;

    // Create mount function
    const mount = <TElement>(spec: RefSpec<TElement>) => spec.create(fullSvc);

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
