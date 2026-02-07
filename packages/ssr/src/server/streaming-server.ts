/// <reference types="node" />
/**
 * Streaming Server
 *
 * High-level abstraction that combines HTML shell, stream writer, service
 * creation, and render-to-stream into a single request handler for
 * progressive SSR.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RefSpec, NodeRef, FragmentRef } from '@rimitive/view/types';
import type { Serialize } from './parse5-adapter';
import { createHtmlShell, type HtmlShellOptions } from './html-shell';
import { renderToStream } from './render-to-stream';
import { generateChunkScript } from './stream-writer';

/**
 * Per-request context passed to the user's createService callback.
 */
export type StreamingRequestContext = {
  /** The pathname from the request URL */
  pathname: string;
  /** Callback to stream a data chunk to the client */
  onResolve: (id: string, data: unknown) => void;
};

/**
 * Result expected from the user's createService callback.
 */
export type StreamingServiceResult<TSvc> = {
  /** The composed service instance */
  service: TSvc;
  /** Serialize a node to HTML (from createParse5Adapter) */
  serialize: Serialize;
  /** Insert fragment markers for async boundaries (from createParse5Adapter) */
  insertFragmentMarkers: (fragment: FragmentRef<unknown>) => void;
};

/**
 * Configuration for createStreamingServer.
 */
export type StreamingServerConfig<TSvc> = {
  /** HTML shell options (title, styles, head content) */
  shell: HtmlShellOptions & { streamKey: string };
  /** Path to the client entry point (e.g., '/client.js') */
  clientSrc: string;
  /** Create a per-request service with streaming wired up */
  createService: (ctx: StreamingRequestContext) => StreamingServiceResult<TSvc>;
  /** Create the app spec from the service */
  createApp: (service: TSvc) => RefSpec<unknown>;
  /** Mount function: creates a NodeRef from a RefSpec using the service */
  mount: (service: TSvc) => (spec: RefSpec<unknown>) => NodeRef<unknown>;
};

/**
 * An async request handler for streaming SSR.
 */
export type StreamingHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<void>;

/**
 * Create a streaming SSR request handler.
 *
 * Combines `createHtmlShell()`, `renderToStream()`, and stream writing
 * into a single handler. For each request:
 *
 * 1. Creates an HTML shell with streaming bootstrap
 * 2. Creates a per-request service with `onResolve` wired to the stream
 * 3. Renders the app to get initial HTML with pending states
 * 4. Writes shell start + initial HTML + client script immediately
 * 5. Waits for all async boundaries to resolve (chunks stream via onResolve)
 * 6. Closes the HTML document
 *
 * @example
 * ```ts
 * const handleStreaming = createStreamingServer({
 *   shell: {
 *     title: 'My App',
 *     streamKey: '__APP_STREAM__',
 *     styles: getStyles(),
 *   },
 *   clientSrc: '/client.js',
 *   createService: ({ pathname, onResolve }) => {
 *     const { adapter, serialize, insertFragmentMarkers } = createParse5Adapter();
 *     const service = createService(adapter, { initialPath: pathname, onResolve });
 *     return { service, serialize, insertFragmentMarkers };
 *   },
 *   createApp: (service) => AppLayout(service),
 *   mount: (service) => (spec) => spec.create(service),
 * });
 *
 * const server = createServer(async (req, res) => {
 *   if (serveStatic(req, res)) return;
 *   if (await handlePrefetch(req, res)) return;
 *   await handleStreaming(req, res);
 * });
 * ```
 */
export function createStreamingServer<TSvc>(
  config: StreamingServerConfig<TSvc>,
): StreamingHandler {
  const { shell: shellOptions, clientSrc, createService, createApp, mount } = config;

  // Create shell once — the template parts are static across requests.
  // Only the stream writer is used per-request for chunk scripts.
  const shell = createHtmlShell(shellOptions);

  return async (req, res) => {
    const url = new URL(
      req.url || '/',
      `http://${req.headers.host || 'localhost'}`,
    );

    // Create per-request service with streaming callback
    const { service, serialize, insertFragmentMarkers } = createService({
      pathname: url.pathname,
      onResolve: (id, data) => {
        if (shell.stream) {
          res.write(generateChunkScript(shell.stream, id, data));
        }
      },
    });

    // Render and get initial HTML with pending states
    const { initialHtml, done } = renderToStream(createApp(service), {
      mount: mount(service),
      serialize,
      insertFragmentMarkers,
    });

    // Write shell + app content + client script immediately.
    // The client script must be sent before streaming completes so the
    // browser can start loading/hydrating while chunks arrive.
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write(shell.start);
    res.write(initialHtml);
    res.write(shell.appClose);
    res.write(`<script type="module" src="${clientSrc}"></script>`);

    // Wait for all async boundaries to resolve.
    // Data chunks are streamed via onResolve as each boundary completes.
    await done;

    // Close the document after all streaming is complete
    res.write('</body></html>');
    res.end();
  };
}
