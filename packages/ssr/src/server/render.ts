/**
 * Server Render Functions
 *
 * Renders Rimitive components to HTML strings for SSR.
 *
 * - renderToString: Synchronous render
 * - renderToStringAsync: Waits for all async boundaries
 * - renderToStream: Progressive streaming render
 */

import type { NodeRef, FragmentRef, RefSpec } from '@rimitive/view/types';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@rimitive/view/types';
import {
  ASYNC_FRAGMENT,
  isAsyncFragment,
  collectAsyncFragments,
  type AsyncFragment,
} from '../shared/async-fragments';
import type { Serialize } from './adapter';

// =============================================================================
// Render to String
// =============================================================================

/**
 * Render a node tree to HTML string
 *
 * @param nodeRef - The node tree to render
 * @param serialize - Function to serialize elements to HTML (from createDOMServerAdapter)
 */
export function renderToString(
  nodeRef: NodeRef<unknown>,
  serialize: Serialize
): string {
  const { status } = nodeRef;
  if (status === STATUS_ELEMENT) return serialize(nodeRef.element);
  if (status === STATUS_FRAGMENT)
    return renderFragmentToString(nodeRef, serialize);
  return '';
}

function renderFragmentToString(
  fragmentRef: FragmentRef<unknown>,
  serialize: Serialize
): string {
  const parts: string[] = [];
  let current = fragmentRef.firstChild;

  while (current) {
    parts.push(renderToString(current, serialize));
    if (current === fragmentRef.lastChild) break;
    current = current.next;
  }

  return parts.join('');
}

// =============================================================================
// Async Rendering
// =============================================================================

export type AsyncRenderable<TElement> =
  | NodeRef<TElement>
  | AsyncFragment<TElement>
  | RefSpec<TElement>;

export type RenderToStringAsyncOptions<TSvc> = {
  svc: TSvc;
  mount: (spec: RefSpec<unknown>) => NodeRef<unknown>;
  serialize: Serialize;
  insertFragmentMarkers: (fragment: FragmentRef<unknown>) => void;
};

function isRefSpec(value: unknown): value is RefSpec<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'create' in value &&
    typeof value.create === 'function'
  );
}

function isNodeRef(value: unknown): value is NodeRef<unknown> {
  if (!value || typeof value !== 'object' || !('status' in value)) return false;
  const { status } = value;
  return status === STATUS_ELEMENT || status === STATUS_FRAGMENT;
}

/**
 * Render to string with async support.
 *
 * Resolves all async fragments (load() boundaries) before returning HTML.
 * Each async fragment's resolve() fetches data and updates internal signals,
 * which causes the reactive content to update in-place (via linkedom).
 *
 * After all resolves complete, fragment markers are inserted around
 * the final resolved content using tree traversal. The parentElement
 * is derived from firstNode.parentNode since content is already in the DOM.
 * This ensures markers wrap the correct content, not the initial pending state.
 *
 * @example
 * ```ts
 * const { adapter, serialize, insertFragmentMarkers } = createDOMServerAdapter();
 * const service = createService(adapter);
 * const html = await renderToStringAsync(appSpec, {
 *   svc: service,
 *   mount: (spec) => spec.create(service),
 *   serialize,
 *   insertFragmentMarkers,
 * });
 * ```
 */
export async function renderToStringAsync<TSvc>(
  renderable: AsyncRenderable<unknown>,
  options: RenderToStringAsyncOptions<TSvc>
): Promise<string> {
  const { mount, serialize, insertFragmentMarkers } = options;

  let nodeRef: NodeRef<unknown>;

  if (isAsyncFragment(renderable)) {
    // Direct async fragment - resolve first, then mount will have correct data
    await renderable[ASYNC_FRAGMENT].resolve();
    nodeRef = renderable;
  } else if (isRefSpec(renderable)) {
    nodeRef = mount(renderable);
  } else if (isNodeRef(renderable)) {
    nodeRef = renderable;
  } else {
    throw new Error(
      `renderToStringAsync: unsupported renderable type. ` +
        `Expected AsyncFragment, RefSpec, or NodeRef.`
    );
  }

  const processedFragments = new Set<AsyncFragment<unknown>>();

  // Resolve all async fragments iteratively
  // Each resolve() updates signals, which updates the DOM via linkedom
  let asyncFragments = collectAsyncFragments(nodeRef).filter(
    (f) => !processedFragments.has(f)
  );

  while (asyncFragments.length > 0) {
    await Promise.all(
      asyncFragments.map(async (fragment) => {
        processedFragments.add(fragment);
        // resolve() fetches data and updates internal signals
        // This causes reactive content to re-render via linkedom
        await fragment[ASYNC_FRAGMENT].resolve();
      })
    );

    // Check for newly discovered async fragments (from resolved content)
    asyncFragments = collectAsyncFragments(nodeRef).filter(
      (f) => !processedFragments.has(f)
    );
  }

  // Insert markers for async fragments AFTER all resolves complete
  // This ensures markers wrap the final resolved content, not the initial pending state
  // parentElement is derived from the DOM tree via firstNode.parentNode
  for (const fragment of processedFragments) {
    // load() always creates a fragment wrapper, so async fragments are always FragmentRefs
    if (fragment.status === STATUS_FRAGMENT) insertFragmentMarkers(fragment);
  }

  return renderToString(nodeRef, serialize);
}

// =============================================================================
// Streaming Render
// =============================================================================

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
   * Function to serialize elements to HTML (from createDOMServerAdapter)
   */
  serialize: Serialize;

  /**
   * Function to insert fragment markers (from createDOMServerAdapter)
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
 * import { createDOMServerAdapter, renderToStream, createStreamWriter } from '@rimitive/ssr/server';
 *
 * const { adapter, serialize, insertFragmentMarkers } = createDOMServerAdapter();
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

  // Collect all async fragments
  const asyncFragments = collectAsyncFragments(nodeRef);

  // Insert fragment markers for async fragments BEFORE serializing.
  // This is needed because createDOMServerAdapter.onAttach skips async fragments
  // (they're normally handled by renderToStringAsync after resolution).
  // For streaming, we need markers around the PENDING state content so
  // the hydration adapter can locate these boundaries.
  for (const fragment of asyncFragments) {
    if (fragment.status === STATUS_FRAGMENT) insertFragmentMarkers(fragment);
  }

  // Get initial HTML (with pending states for load() boundaries)
  const initialHtml = renderToString(nodeRef, serialize);
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

  return {
    initialHtml,
    done,
    pendingCount,
  };
}
