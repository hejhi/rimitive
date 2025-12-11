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
  /**
   * Bootstrap script for streaming - include in <head>.
   * Sets up the data queue for chunks that arrive before hydration.
   */
  headScript: string;

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

/**
 * Default chunk formatter for streaming data
 */
export function defaultChunkFormatter(id: string, data: unknown): string {
  return `<script>__LATTICE_DATA__(${JSON.stringify(id)},${JSON.stringify(data)})</script>`;
}

/**
 * Bootstrap script for streaming SSR.
 * Sets up a queue for data chunks that arrive before hydration completes.
 * @internal
 */
const BOOTSTRAP_SCRIPT = `<script>
window.__LATTICE_DATA_QUEUE__=[];
window.__LATTICE_DATA__=function(i,d){
if(window.__LATTICE_LOADER__)window.__LATTICE_LOADER__.setData(i,d);
else window.__LATTICE_DATA_QUEUE__.push([i,d]);
};
</script>`;

/**
 * Render to stream for progressive SSR.
 *
 * Returns all pieces needed for streaming: bootstrap script for head,
 * initial HTML for body, and client script tag. The server just writes
 * what we return - no need to handle IIFE vs module builds manually.
 *
 * @example
 * ```ts
 * // Create service with streaming callback
 * const service = createService(adapter, {
 *   onResolve: (id, data) => res.write(defaultChunkFormatter(id, data)),
 * });
 *
 * // Render and get all pieces
 * const { headScript, initialHtml, clientScript, done } = renderToStream(
 *   AppLayout(service),
 *   {
 *     mount: (spec) => spec.create(service),
 *     clientSrc: '/client.js',
 *   }
 * );
 *
 * // Write HTML document
 * res.write(`<!DOCTYPE html><html><head>${headScript}</head><body>`);
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
    headScript: BOOTSTRAP_SCRIPT,
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
 * import { createStreamingLoader, renderToStream } from '@lattice/ssr/server';
 *
 * const { loader, getChunks } = createStreamingLoader({ signal });
 *
 * const App = createApp(loader);
 * const { initialHtml, done } = renderToStream(App, {
 *   loader,
 *   mount: (spec) => spec.create(svc),
 * });
 *
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

  /** Initial data for hydration (optional) */
  initialData?: Record<string, unknown>;

  /** Custom chunk formatter */
  formatChunk?: (id: string, data: unknown) => string;
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
  const { signal, initialData, formatChunk = defaultChunkFormatter } = options;

  const chunks: string[] = [];

  const loader = createLoader({
    signal,
    initialData,
    onResolve: (id: string, data: unknown) => {
      chunks.push(formatChunk(id, data));
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
