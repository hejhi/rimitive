/// <reference types="node" />
/**
 * Data Prefetch Handler
 *
 * Serves pre-rendered data for client-side navigation. When the client
 * navigates to a new route, it fetches data from `/_data/:path` instead
 * of performing a full SSR pass.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RefSpec, NodeRef } from '@rimitive/view/types';
import { renderToData } from './render-to-data';

/**
 * Configuration for the data prefetch handler.
 */
export type DataPrefetchHandlerConfig<TSvc> = {
  /** URL prefix for data endpoints (defaults to '/_data') */
  prefix?: string;
  /** Create a service instance for the given path */
  createService: (path: string) => TSvc;
  /** Create the app spec from the service */
  createApp: (service: TSvc) => RefSpec<unknown>;
  /** Mount function: creates a NodeRef from a RefSpec using the service */
  mount: (service: TSvc) => (spec: RefSpec<unknown>) => NodeRef<unknown>;
  /** Get collected loader data from the service */
  getData: (service: TSvc) => Record<string, unknown>;
};

/**
 * An async handler that serves prefetch data.
 * Returns `true` if the request was handled, `false` if it should be passed on.
 */
export type DataPrefetchHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<boolean>;

/**
 * Create a handler that serves pre-rendered data for client-side navigation.
 *
 * Matches URLs starting with `prefix` (default `/_data`), extracts the
 * path, creates a throwaway service, renders the app to collect data
 * (without producing HTML), and returns the data as JSON.
 *
 * @example
 * ```ts
 * const handlePrefetch = createDataPrefetchHandler({
 *   createService: (path) => {
 *     const { adapter } = createParse5Adapter();
 *     return createService(adapter, { initialPath: path });
 *   },
 *   createApp: (service) => AppLayout(service),
 *   mount: (service) => (spec) => spec.create(service),
 *   getData: (service) => service.loader.getData(),
 * });
 *
 * const server = createServer(async (req, res) => {
 *   if (await handlePrefetch(req, res)) return;
 *   // ... handle other routes
 * });
 * ```
 */
export function createDataPrefetchHandler<TSvc>(
  config: DataPrefetchHandlerConfig<TSvc>,
): DataPrefetchHandler {
  const { prefix = '/_data', createService, createApp, mount, getData } = config;

  return async (req, res) => {
    const url = req.url;
    if (!url || !url.startsWith(prefix + '/')) return false;

    const path = url.slice(prefix.length) || '/';
    const service = createService(path);

    const data = await renderToData(createApp(service), {
      mount: mount(service),
      getData: () => getData(service),
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return true;
  };
}
