/**
 * Streaming SSR
 *
 * Renders initial HTML immediately (with pending states for async boundaries),
 * then streams data chunks as each load() boundary resolves. The client's
 * reactive system updates the UI when data arrives.
 *
 * This is more efficient than renderToStringAsync for large pages with slow
 * data sources, as users see content progressively.
 */

import type { RefSpec, NodeRef } from '@lattice/view/types';
import { STATUS_FRAGMENT } from '@lattice/view/types';
import { createLoader, type Loader } from '@lattice/view/load';
import type { SignalFactory } from '@lattice/signals/signal';
import { renderToString } from './renderToString';
import { collectAsyncFragments, ASYNC_FRAGMENT } from './async-fragments';
import { insertFragmentMarkers } from '../adapters/dom-server';

/**
 * Options for renderToStream
 */
export type RenderToStreamOptions = {
  /**
   * Mount function to create NodeRef from RefSpec.
   * The mount function should use a loader created with onResolve
   * to enable streaming chunks.
   */
  mount: (spec: RefSpec<unknown>) => NodeRef<unknown>;

  /**
   * URL path to the client bundle (e.g., '/client.js').
   * If provided, generates a blocking script tag to ensure hydration
   * completes before streaming data chunks are processed.
   */
  clientSrc?: string;
};

/**
 * Result from renderToStream
 */
export type StreamResult = {
  /** The initial HTML string (with pending states for async boundaries) */
  initialHtml: string;

  /**
   * Client script tag - include after initialHtml, before streaming chunks.
   * Uses blocking (non-module) script to ensure hydration completes first.
   * Empty string if clientSrc was not provided.
   */
  clientScript: string;

  /**
   * Promise that resolves when all async boundaries have resolved.
   * The actual data chunks are delivered via the loader's onResolve callback.
   */
  done: Promise<void>;

  /** Number of pending async boundaries */
  pendingCount: number;
};

// =============================================================================
// Streaming Proxy
// =============================================================================

/**
 * Create bootstrap script that sets up a streaming proxy at the given key.
 *
 * The proxy queues data chunks until a loader connects, then forwards directly.
 * User controls the key name, making the connection explicit and traceable.
 *
 * @param streamKey - The window property name (e.g., '__MY_APP_STREAM__')
 * @returns Script tag string to include in <head>
 *
 * @example
 * ```ts
 * // Server
 * const STREAM_KEY = '__APP_STREAM__';
 * res.write(createStreamingBootstrap(STREAM_KEY));
 *
 * // Streams data via:
 * res.write(createChunkScript(STREAM_KEY, 'stats', { users: 100 }));
 * ```
 */
export function createStreamingBootstrap(streamKey: string): string {
  return `<script>
window.${streamKey} = {
  queue: [],
  loader: null,
  push: function(id, data) {
    if (this.loader) {
      this.loader.setData(id, data);
    } else {
      this.queue.push([id, data]);
    }
  },
  connect: function(loader) {
    this.loader = loader;
    for (var i = 0; i < this.queue.length; i++) {
      loader.setData(this.queue[i][0], this.queue[i][1]);
    }
    this.queue = [];
  }
};
</script>`;
}

/**
 * Create a script tag that pushes data to the streaming proxy.
 *
 * @param streamKey - The window property name used in createStreamingBootstrap
 * @param id - The async boundary ID
 * @param data - The resolved data
 * @returns Script tag string
 *
 * @example
 * ```ts
 * res.write(createChunkScript('__APP_STREAM__', 'stats', { users: 100 }));
 * // Outputs: <script>__APP_STREAM__.push("stats",{"users":100})</script>
 * ```
 */
export function createChunkScript(streamKey: string, id: string, data: unknown): string {
  return `<script>${streamKey}.push(${JSON.stringify(id)},${JSON.stringify(data)})</script>`;
}

/**
 * Render to stream for progressive SSR.
 *
 * Returns initial HTML and client script. Use with createStreamingBootstrap()
 * and createChunkScript() for the full streaming flow.
 *
 * @example
 * ```ts
 * const STREAM_KEY = '__APP_STREAM__';
 *
 * // Create service with streaming callback
 * const service = createService(adapter, {
 *   onResolve: (id, data) => res.write(createChunkScript(STREAM_KEY, id, data)),
 * });
 *
 * // Render
 * const { initialHtml, clientScript, done } = renderToStream(
 *   AppLayout(service),
 *   { mount: (spec) => spec.create(service), clientSrc: '/client.js' }
 * );
 *
 * // Write HTML document
 * res.write(`<!DOCTYPE html><html><head>`);
 * res.write(createStreamingBootstrap(STREAM_KEY));
 * res.write(`</head><body>`);
 * res.write(initialHtml);
 * res.write(clientScript);
 * await done;  // Data chunks stream via onResolve
 * res.write('</body></html>');
 * res.end();
 * ```
 */
export function renderToStream(
  spec: RefSpec<unknown>,
  options: RenderToStreamOptions
): StreamResult {
  const { mount, clientSrc } = options;

  // Mount the app synchronously - this renders with pending states
  const nodeRef = mount(spec);

  // Collect all async fragments
  const asyncFragments = collectAsyncFragments(nodeRef);

  // Insert fragment markers for async fragments BEFORE serializing.
  // This is needed because createDOMServerAdapter.onAttach skips async fragments
  // (they're normally handled by renderToStringAsync after resolution).
  // For streaming, we need markers around the PENDING state content so
  // the hydration adapter can locate these boundaries.
  for (const fragment of asyncFragments) {
    if (fragment.status === STATUS_FRAGMENT) {
      insertFragmentMarkers(fragment);
    }
  }

  // Get initial HTML (with pending states for load() boundaries)
  const initialHtml = renderToString(nodeRef);
  const pendingCount = asyncFragments.length;

  // Create promise that resolves when all async boundaries complete
  // Data chunks are delivered via the loader's onResolve callback
  const done =
    pendingCount === 0
      ? Promise.resolve()
      : Promise.all(
          asyncFragments.map((fragment) =>
            fragment[ASYNC_FRAGMENT].resolve().catch(() => {
              // Errors are handled by the loader's error state
              // Don't let one failure break the whole stream
            })
          )
        ).then(() => undefined);

  // Generate client script tag if clientSrc provided
  // Uses blocking (non-module) script to ensure hydration completes
  // before streaming data chunks are processed
  const clientScript = clientSrc ? `<script src="${clientSrc}"></script>` : '';

  return {
    initialHtml,
    clientScript,
    done,
    pendingCount,
  };
}

/**
 * Helper to create a loader that buffers chunks for streaming SSR.
 *
 * @example
 * ```ts
 * import { createStreamingLoader, renderToStream, createStreamingBootstrap } from '@lattice/ssr/server';
 *
 * const STREAM_KEY = '__APP_STREAM__';
 * const { loader, getChunks } = createStreamingLoader({ signal, streamKey: STREAM_KEY });
 *
 * const App = createApp(loader);
 * const { initialHtml, done } = renderToStream(App, {
 *   mount: (spec) => spec.create(svc),
 * });
 *
 * res.write(createStreamingBootstrap(STREAM_KEY));
 * res.write(initialHtml);
 * await done;
 * for (const chunk of getChunks()) {
 *   res.write(chunk);
 * }
 * res.end();
 * ```
 */
export type CreateStreamingLoaderOptions = {
  /** Signal factory for creating reactive state */
  signal: SignalFactory;

  /** The streaming proxy key (same as used in createStreamingBootstrap) */
  streamKey: string;

  /** Initial data for hydration (optional) */
  initialData?: Record<string, unknown>;
};

export type StreamingLoaderResult = {
  loader: Loader;
  getChunks: () => string[];
  clearChunks: () => void;
};

/**
 * Create a loader that buffers chunks for streaming.
 *
 * Chunks are buffered in an array that you can access via getChunks().
 * This is useful when you need to write chunks after the initial HTML.
 */
export function createStreamingLoader(
  options: CreateStreamingLoaderOptions
): StreamingLoaderResult {
  const { signal, streamKey, initialData } = options;

  const chunks: string[] = [];

  const loader = createLoader({
    signal,
    initialData,
    onResolve: (id: string, data: unknown) => {
      chunks.push(createChunkScript(streamKey, id, data));
    },
  });

  return {
    loader,
    getChunks: () => chunks,
    clearChunks: () => {
      chunks.length = 0;
    },
  };
}
