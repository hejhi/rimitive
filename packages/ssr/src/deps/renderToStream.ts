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
// Stream Writer
// =============================================================================

/**
 * Creates the streaming receiver object.
 * This function is stringified and executed in the browser.
 * Queues data chunks until a loader connects, then forwards directly.
 * @internal
 */
function createStreamingReceiver() {
  const queue: Array<[string, unknown]> = [];
  let loader: { setData: (id: string, data: unknown) => void } | null = null;

  return {
    push(id: string, data: unknown) {
      if (loader) {
        loader.setData(id, data);
      } else {
        queue.push([id, data]);
      }
    },
    connect(l: { setData: (id: string, data: unknown) => void }) {
      loader = l;
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (item) l.setData(item[0], item[1]);
      }
      queue.length = 0;
    },
  };
}

/**
 * A factory for generating streaming script tags.
 */
export type StreamWriter = {
  /** The stream key (window property name) */
  key: string;
  /** Script tag that initializes the streaming receiver */
  bootstrap: () => string;
  /** Script tag that pushes data to the receiver */
  chunk: (id: string, data: unknown) => string;
};

/**
 * Create a stream writer for generating streaming script tags.
 *
 * The writer generates script tags that set up and communicate with a
 * streaming receiver on the client. The receiver queues data chunks until
 * a loader connects, then forwards directly.
 *
 * @param streamKey - The window property name (e.g., '__MY_APP_STREAM__')
 * @returns StreamWriter with bootstrap() and chunk() methods
 *
 * @example
 * ```ts
 * const stream = createStreamWriter('__APP_STREAM__');
 *
 * res.write(`<head>${stream.bootstrap()}</head>`);
 * res.write(`<body>${initialHtml}</body>`);
 *
 * // As async boundaries resolve:
 * res.write(stream.chunk('stats', { users: 100 }));
 * ```
 */
export function createStreamWriter(streamKey: string): StreamWriter {
  return {
    key: streamKey,
    bootstrap: () =>
      `<script>window.${streamKey}=(${createStreamingReceiver.toString()})();</script>`,
    chunk: (id, data) =>
      `<script>${streamKey}.push(${JSON.stringify(id)},${JSON.stringify(data)})</script>`,
  };
}

/**
 * Render to stream for progressive SSR.
 *
 * Returns initial HTML and client script. Use with createStreamWriter()
 * for the full streaming flow.
 *
 * @example
 * ```ts
 * const stream = createStreamWriter('__APP_STREAM__');
 *
 * // Create service with streaming callback
 * const service = createService(adapter, {
 *   onResolve: (id, data) => res.write(stream.chunk(id, data)),
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
 * res.write(stream.bootstrap());
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
 * import { createStreamLoader, renderToStream, createStreamWriter } from '@lattice/ssr/server';
 *
 * const stream = createStreamWriter('__APP_STREAM__');
 * const { loader, getChunks } = createStreamLoader({ signal, stream });
 *
 * const App = createApp(loader);
 * const { initialHtml, done } = renderToStream(App, {
 *   mount: (spec) => spec.create(svc),
 * });
 *
 * res.write(stream.bootstrap());
 * res.write(initialHtml);
 * await done;
 * for (const chunk of getChunks()) {
 *   res.write(chunk);
 * }
 * res.end();
 * ```
 */
export type StreamLoaderOptions = {
  /** Signal factory for creating reactive state */
  signal: SignalFactory;

  /** The stream writer (from createStreamWriter) */
  stream: StreamWriter;

  /** Initial data for hydration (optional) */
  initialData?: Record<string, unknown>;
};

export type StreamLoaderResult = {
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
export function createStreamLoader(
  options: StreamLoaderOptions
): StreamLoaderResult {
  const { signal, stream, initialData } = options;

  const chunks: string[] = [];

  const loader = createLoader({
    signal,
    initialData,
    onResolve: (id: string, data: unknown) => {
      chunks.push(stream.chunk(id, data));
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
