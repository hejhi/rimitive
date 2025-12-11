/**
 * Render to Stream
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

/**
 * Render to stream for progressive SSR.
 *
 * Returns initial HTML and client script. Use with createStreamWriter()
 * for the full streaming flow.
 *
 * @example
 * ```ts
 * import { renderToStream } from '@lattice/ssr/server';
 * import { createStreamWriter } from '@lattice/ssr/server';
 *
 * const { bootstrap, chunk } = createStreamWriter('__APP_STREAM__');
 *
 * // Create service with streaming callback
 * const service = createService(adapter, {
 *   onResolve: (id, data) => res.write(chunk(id, data)),
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
 * res.write(bootstrap());
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
