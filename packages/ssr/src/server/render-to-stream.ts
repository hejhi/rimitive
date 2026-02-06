/**
 * Streaming rendering for progressive SSR.
 *
 * Returns initial HTML with pending states, then resolves async boundaries
 * via the loader's onResolve callback for progressive delivery.
 */

import type { NodeRef, FragmentRef, RefSpec } from '@rimitive/view/types';
import { STATUS_FRAGMENT } from '@rimitive/view/types';
import { collectAsyncFragments } from '../shared/async-fragments';
import type { Serialize } from './parse5-adapter';
import { renderToString } from './render-to-string';
import { resolveAllAsyncFragments } from './resolve-fragments';

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
   * Function to serialize elements to HTML (from createParse5Adapter)
   */
  serialize: Serialize;

  /**
   * Function to insert fragment markers (from createParse5Adapter)
   */
  insertFragmentMarkers: (fragment: FragmentRef<unknown>) => void;
};

/**
 * Result from renderToStream
 */
export type StreamResult = {
  /** The initial HTML string (with pending states for async boundaries) */
  initialHtml: string;

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
 * Returns initial HTML. Use with createStreamWriter() for the full streaming flow.
 *
 * @example
 * ```ts
 * import { createParse5Adapter, renderToStream, createStreamWriter } from '@rimitive/ssr/server';
 *
 * const { adapter, serialize, insertFragmentMarkers } = createParse5Adapter();
 * const stream = createStreamWriter('__APP_STREAM__');
 *
 * // Create service with streaming callback
 * const service = createService(adapter, {
 *   onResolve: (id, data) => res.write(`<script>${stream.chunkCode(id, data)}</script>`),
 * });
 *
 * // Render
 * const { initialHtml, done } = renderToStream(
 *   AppLayout(service),
 *   { mount: (spec) => spec.create(service), serialize, insertFragmentMarkers }
 * );
 *
 * // Write HTML document
 * res.write(`<!DOCTYPE html><html><head>`);
 * res.write(`<script>${stream.bootstrapCode()}</script>`);
 * res.write(`</head><body>`);
 * res.write(initialHtml);
 * res.write(`<script src="/client.js"></script>`);
 * await done;  // Data chunks stream via onResolve
 * res.write('</body></html>');
 * res.end();
 * ```
 */
export function renderToStream(
  spec: RefSpec<unknown>,
  options: RenderToStreamOptions
): StreamResult {
  const { mount, serialize, insertFragmentMarkers } = options;

  // Mount the app synchronously - this renders with pending states
  const nodeRef = mount(spec);

  // Collect initial async fragments for marker insertion and counting
  const initialFragments = collectAsyncFragments(nodeRef);

  // Insert fragment markers for async fragments BEFORE serializing.
  // This is needed because the adapter's onAttach skips async fragments
  // (they're normally handled by renderToStringAsync after resolution).
  // For streaming, we need markers around the PENDING state content so
  // the hydration adapter can locate these boundaries.
  for (const fragment of initialFragments) {
    if (fragment.status === STATUS_FRAGMENT) insertFragmentMarkers(fragment);
  }

  // Get initial HTML (with pending states for load() boundaries)
  const initialHtml = renderToString(nodeRef, serialize);
  const pendingCount = initialFragments.length;

  // Resolve all async boundaries with cascading support.
  // Uses catchErrors so one failure doesn't break the whole stream.
  // Data chunks are delivered via the loader's onResolve callback.
  const done =
    pendingCount === 0
      ? Promise.resolve()
      : resolveAllAsyncFragments(nodeRef, { catchErrors: true }).then(
          () => undefined
        );

  return {
    initialHtml,
    done,
    pendingCount,
  };
}
