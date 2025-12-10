/**
 * Island-aware renderToString for SSR
 *
 * Renders a node tree to HTML string. Islands are automatically decorated during rendering:
 * - Element islands: script tags added via decorateElement
 * - Fragment islands: wrapped in divs with script tags via decorateFragment
 *
 * Also provides async rendering support for async fragment boundaries (load()).
 */

import type {
  NodeRef,
  ElementRef,
  FragmentRef,
  RefSpec,
} from '@lattice/view/types';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';
import {
  isAsyncFragment,
  resolveAsyncFragment,
  collectAsyncFragments,
  type AsyncFragmentRef,
} from '@lattice/resource';

/**
 * Render a node tree to HTML string
 *
 * @param nodeRef - The rendered node reference from mount() or create()
 * @returns HTML string with island markers already in place
 *
 * @example
 * ```typescript
 * import { createIslandsServerApp } from '@lattice/islands/server';
 * import { renderToString } from '@lattice/islands/deps/renderToString';
 *
 * const { el, mount } = createIslandsServerApp();
 * const app = el('div')(el('h1')('Hello World'));
 * const html = renderToString(mount(app));
 * ```
 */
export function renderToString(nodeRef: NodeRef<unknown>): string {
  if (nodeRef.status === STATUS_ELEMENT) return renderElementToString(nodeRef);
  if (nodeRef.status === STATUS_FRAGMENT)
    return renderFragmentToString(nodeRef);

  // Unknown type - return empty string
  return '';
}

/**
 * Render an element ref to HTML string
 *
 * With fragments now decorated in the DOM (via decorateFragment), we can simply
 * use outerHTML - fragment boundaries are already marked with HTML comments.
 */
function renderElementToString(elementRef: ElementRef<unknown>): string {
  const element = elementRef.element as { outerHTML?: string };

  if (typeof element.outerHTML !== 'string') {
    throw new Error(
      'Element does not have outerHTML property. Are you using linkedom renderer?'
    );
  }

  return element.outerHTML;
}

/**
 * Render a fragment ref to HTML string by concatenating all children
 *
 * Fragments don't have a DOM element, so we walk their children and concatenate.
 * Fragment boundaries are already marked in the DOM with comments (via decorateFragment).
 */
function renderFragmentToString(fragmentRef: FragmentRef<unknown>): string {
  const parts: string[] = [];
  let current = fragmentRef.firstChild;

  while (current) {
    parts.push(renderToString(current));

    if (current === fragmentRef.lastChild) break;
    current = current.next;
  }

  return parts.join('');
}

// =============================================================================
// Async Rendering - For async fragment (load()) boundaries
// =============================================================================

/**
 * Input types that can be rendered asynchronously
 */
export type AsyncRenderable<TElement> =
  | NodeRef<TElement>
  | AsyncFragmentRef<TElement>
  | RefSpec<TElement>;

/**
 * Options for async rendering
 */
export type RenderToStringAsyncOptions<TSvc> = {
  /**
   * Service context to pass to loaders and component creation
   */
  svc: TSvc;

  /**
   * Mount function to create NodeRef from RefSpec
   */
  mount: (spec: RefSpec<unknown>) => NodeRef<unknown>;

  /**
   * Optional callback when an async fragment is resolved
   * Useful for collecting data for serialization
   */
  onAsyncResolved?: (id: string, data: unknown) => void;
};

/**
 * Check if a value is a RefSpec
 */
function isRefSpec(value: unknown): value is RefSpec<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'create' in value &&
    typeof (value as RefSpec<unknown>).create === 'function'
  );
}

/**
 * Check if a value is a NodeRef
 */
function isNodeRef(value: unknown): value is NodeRef<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const status = (value as { status?: number }).status;
  return status === STATUS_ELEMENT || status === STATUS_FRAGMENT;
}

/**
 * Get the first DOM node from a NodeRef, traversing into fragments
 */
function getFirstDOMNode(nodeRef: NodeRef<unknown>): Node | null {
  let current: NodeRef<unknown> | null = nodeRef;
  while (current) {
    if (current.status === STATUS_ELEMENT) {
      return current.element as Node;
    }
    if (current.status === STATUS_FRAGMENT) {
      current = current.firstChild;
    } else {
      break;
    }
  }
  return null;
}

/**
 * Remove all DOM nodes belonging to a NodeRef from a parent element.
 */
function removeNodeFromDOM<TElement>(
  parentElement: Element,
  nodeRef: NodeRef<TElement>
): void {
  if (nodeRef.status === STATUS_ELEMENT && nodeRef.element) {
    parentElement.removeChild(nodeRef.element as unknown as Node);
  } else if (nodeRef.status === STATUS_FRAGMENT) {
    // For fragments, remove all child elements
    let child = nodeRef.firstChild;
    while (child) {
      removeNodeFromDOM(parentElement, child);
      if (child === nodeRef.lastChild) break;
      child = child.next;
    }
  }
}

/**
 * Find the fragment-end comment marker by scanning forward from a start node.
 * This is needed to insert resolved content in the correct position
 * (between fragment-start and fragment-end markers).
 */
function findFragmentEndMarker(startFrom: Node | null): Comment | null {
  let node = startFrom;
  while (node) {
    if (
      node.nodeType === 8 && // Comment node
      (node as Comment).textContent === 'fragment-end'
    ) {
      return node as Comment;
    }
    node = node.nextSibling;
  }
  return null;
}

/**
 * Attach resolved content to an async fragment.
 * Links the resolved node as the fragment's child AND inserts DOM nodes into parent.
 *
 * IMPORTANT: This also removes any existing content (e.g., pending state rendered by attach())
 * before inserting the resolved content. This ensures SSR only outputs the ready state.
 *
 * The content is inserted between the fragment's <!--fragment-start--> and <!--fragment-end-->
 * comment markers to ensure hydration can correctly match the structure.
 */
function attachResolvedContent<TElement>(
  fragment: AsyncFragmentRef<TElement>,
  nodeRef: NodeRef<TElement>
): void {
  const parentRef = fragment.parent;
  const parentElement = parentRef?.status === STATUS_ELEMENT
    ? parentRef.element as unknown as Element
    : null;

  // Remove existing content (pending state) from DOM before adding resolved content
  // Keep track of where the fragment markers are
  let fragmentEndMarker: Comment | null = null;

  if (parentElement && typeof parentElement.removeChild === 'function') {
    const existingChild = fragment.firstChild;
    if (existingChild) {
      // Find the fragment-end marker before removing content
      // It should be right after the existing content
      const existingFirstNode = getFirstDOMNode(existingChild);
      if (existingFirstNode) {
        fragmentEndMarker = findFragmentEndMarker(existingFirstNode);
      }
      removeNodeFromDOM(parentElement, existingChild);
    }
  }

  // Set parent reference on the child
  if (nodeRef.status === STATUS_ELEMENT || nodeRef.status === STATUS_FRAGMENT) {
    nodeRef.parent = fragment.parent;
  }

  // Link as fragment's child in the logical tree
  fragment.firstChild = nodeRef;
  fragment.lastChild = nodeRef;

  // Insert DOM nodes into parent element
  // This is critical for SSR: the DOM tree must contain the content for outerHTML to work
  if (!parentElement || typeof parentElement.insertBefore !== 'function') {
    return;
  }

  // Find reference node for insertion
  // If we found a fragment-end marker, insert before it to keep content inside the fragment
  // Otherwise fall back to inserting before the next sibling's first node
  let refNode: Node | null = fragmentEndMarker;
  if (!refNode && fragment.next) {
    refNode = getFirstDOMNode(fragment.next);
  }

  // Insert the resolved content's DOM node(s)
  if (nodeRef.status === STATUS_ELEMENT && nodeRef.element) {
    parentElement.insertBefore(nodeRef.element as unknown as Node, refNode);
  } else if (nodeRef.status === STATUS_FRAGMENT) {
    // For fragment results, insert all child elements
    let child = nodeRef.firstChild;
    while (child) {
      if (child.status === STATUS_ELEMENT && child.element) {
        parentElement.insertBefore(child.element as unknown as Node, refNode);
      }
      if (child === nodeRef.lastChild) break;
      child = child.next;
    }
  }
}

/**
 * Render a component to HTML string, awaiting any async fragment boundaries
 *
 * This is the main async SSR entry point. It handles:
 * - Async fragments (load()) at any level in the tree
 * - RefSpec components that need to be mounted
 * - Already-mounted NodeRef trees
 *
 * The flow is:
 * 1. Mount the tree (async fragments are empty placeholders)
 * 2. Walk the tree to find all async fragments
 * 3. Resolve all async loaders in parallel
 * 4. Attach resolved content to each fragment
 * 5. Render the complete tree to HTML
 *
 * @param renderable - The component to render (AsyncFragmentRef, RefSpec, or NodeRef)
 * @param options - Rendering options including svc and mount function
 * @returns Promise that resolves to HTML string
 *
 * @example
 * ```typescript
 * import { renderToStringAsync } from '@lattice/ssr/server';
 * import { load } from '@lattice/resource';
 *
 * const ProductPage = load(async (svc) => {
 *   const products = await fetch('/api/products').then(r => r.json());
 *   return (svc) => svc.el('div')(products.map(p => svc.el('span')(p.name)));
 * });
 *
 * // ProductPage can be used directly or as a child
 * const App = (svc) => svc.el('main')(
 *   svc.el('h1')('My App'),
 *   ProductPage  // Async fragment as child
 * );
 *
 * const html = await renderToStringAsync(mount(App(svc)), {
 *   svc,
 *   mount: (spec) => mount(spec),
 * });
 * ```
 */
export async function renderToStringAsync<TSvc>(
  renderable: AsyncRenderable<unknown>,
  options: RenderToStringAsyncOptions<TSvc>
): Promise<string> {
  const { mount, onAsyncResolved } = options;

  let nodeRef: NodeRef<unknown>;

  // Handle async fragment at root - resolve first, then mount result
  if (isAsyncFragment(renderable)) {
    const refSpec = await resolveAsyncFragment(renderable);

    // Notify caller of resolution (for data serialization)
    if (onAsyncResolved) {
      onAsyncResolved(renderable.__id, renderable.__data);
    }

    // Mount the resolved component
    nodeRef = mount(refSpec);
  }
  // Handle RefSpec - mount it
  else if (isRefSpec(renderable)) {
    nodeRef = mount(renderable);
  }
  // Handle NodeRef - use directly
  else if (isNodeRef(renderable)) {
    nodeRef = renderable;
  }
  // Unknown type
  else {
    throw new Error(
      `renderToStringAsync: unsupported renderable type. ` +
        `Expected AsyncFragmentRef, RefSpec, or NodeRef.`
    );
  }

  // Find and resolve all async fragments, including nested ones
  // Use a loop because resolved fragments may contain more async fragments
  // Use a Set to track already-processed fragments by identity
  const processedFragments = new Set<AsyncFragmentRef<unknown>>();

  let asyncFragments = collectAsyncFragments(nodeRef).filter(
    (f) => !processedFragments.has(f)
  );

  while (asyncFragments.length > 0) {
    // Resolve current batch in parallel
    await Promise.all(
      asyncFragments.map(async (fragment) => {
        // Mark as processed first to avoid re-processing
        processedFragments.add(fragment);

        // Resolve the loader - returns RefSpec directly
        const refSpec = await resolveAsyncFragment(fragment);

        // Notify caller of resolution
        if (onAsyncResolved) {
          onAsyncResolved(fragment.__id, fragment.__data);
        }

        // Mount the RefSpec
        const resolvedNodeRef = mount(refSpec);

        // Attach the resolved content to the fragment
        attachResolvedContent(fragment, resolvedNodeRef);
      })
    );

    // Check for newly discovered async fragments in the resolved content
    // Filter out already-processed ones
    asyncFragments = collectAsyncFragments(nodeRef).filter(
      (f) => !processedFragments.has(f)
    );
  }
  // Render the complete tree
  return renderToString(nodeRef);
}

// Re-export for convenience
export { isAsyncFragment };

// =============================================================================
// Hydration Data Serialization
// =============================================================================

/**
 * Collected hydration data from async fragments
 */
export type HydrationData = Record<string, unknown>;

/**
 * Collect hydration data from all resolved async fragments.
 * Call this after renderToStringAsync to get data for serialization.
 *
 * @param nodeRef - The root node of the rendered tree
 * @returns Map of fragment IDs to their hydration data
 *
 * @example
 * ```typescript
 * const html = await renderToStringAsync(App, options);
 * const data = collectHydrationData(nodeRef);
 * const script = createHydrationScript(data);
 * ```
 */
export function collectHydrationData(nodeRef: NodeRef<unknown>): HydrationData {
  const data: HydrationData = {};
  const fragments = collectAsyncFragments(nodeRef);

  for (const fragment of fragments) {
    if (fragment.__data !== undefined) {
      data[fragment.__id] = fragment.__data;
    }
  }

  return data;
}

/**
 * Create a script tag containing serialized hydration data.
 * The data is stored in window.__LATTICE_HYDRATION_DATA__.
 *
 * @param data - Hydration data collected from async fragments
 * @returns HTML script tag string
 *
 * @example
 * ```typescript
 * const data = collectHydrationData(nodeRef);
 * const script = createHydrationScript(data);
 * // <script>window.__LATTICE_HYDRATION_DATA__={"load-1":{...}}</script>
 * ```
 */
export function createHydrationScript(data: HydrationData): string {
  if (Object.keys(data).length === 0) {
    return '';
  }

  // Serialize with escaping for script context
  const json = JSON.stringify(data)
    // Escape </script> to prevent XSS
    .replace(/<\/script/gi, '<\\/script')
    // Escape <!-- to prevent breaking out of script
    .replace(/<!--/g, '<\\!--');

  return `<script>window.__LATTICE_HYDRATION_DATA__=${json}</script>`;
}

/**
 * Options for renderToStringAsyncWithHydration
 */
export type RenderWithHydrationOptions<TSvc> =
  RenderToStringAsyncOptions<TSvc> & {
    /**
     * Where to inject the hydration script.
     * - 'head': Before </head>
     * - 'body': Before </body>
     * - 'inline': Return { html, script } separately
     *
     * @default 'body'
     */
    scriptPlacement?: 'head' | 'body' | 'inline';
  };

/**
 * Result from renderToStringAsyncWithHydration when scriptPlacement is 'inline'
 */
export type RenderWithHydrationInlineResult = {
  html: string;
  script: string;
  data: HydrationData;
};

/**
 * Render to HTML string with hydration data automatically collected and injected.
 *
 * This is a convenience wrapper that:
 * 1. Renders the component with renderToStringAsync
 * 2. Collects hydration data from all async fragments
 * 3. Creates and injects the hydration script
 *
 * @param renderable - The component to render
 * @param options - Rendering options
 * @returns HTML string with hydration script, or object if scriptPlacement is 'inline'
 *
 * @example
 * ```typescript
 * import { renderToStringAsyncWithHydration } from '@lattice/ssr/server';
 * import { load } from '@lattice/resource';
 *
 * const ProductPage = load(async (svc) => {
 *   const products = await fetch('/api/products').then(r => r.json());
 *   return {
 *     hydrationData: products,
 *     component: (svc) => svc.el('div')(products.map(p => svc.el('span')(p.name)))
 *   };
 * });
 *
 * // HTML includes <script>window.__LATTICE_HYDRATION_DATA__=...</script>
 * const html = await renderToStringAsyncWithHydration(mount(App(svc)), {
 *   svc,
 *   mount,
 *   scriptPlacement: 'body'
 * });
 * ```
 */
export async function renderToStringAsyncWithHydration<TSvc>(
  renderable: AsyncRenderable<unknown>,
  options: RenderWithHydrationOptions<TSvc> & { scriptPlacement: 'inline' }
): Promise<RenderWithHydrationInlineResult>;
export async function renderToStringAsyncWithHydration<TSvc>(
  renderable: AsyncRenderable<unknown>,
  options: RenderWithHydrationOptions<TSvc>
): Promise<string>;
export async function renderToStringAsyncWithHydration<TSvc>(
  renderable: AsyncRenderable<unknown>,
  options: RenderWithHydrationOptions<TSvc>
): Promise<string | RenderWithHydrationInlineResult> {
  const { scriptPlacement = 'body', ...renderOptions } = options;

  // Track all resolved async fragments
  const resolvedFragments: Array<{ id: string; data: unknown }> = [];

  // Render with callback to collect data
  const html = await renderToStringAsync(renderable, {
    ...renderOptions,
    onAsyncResolved: (id, data) => {
      if (data !== undefined) {
        resolvedFragments.push({ id, data });
      }
      // Also call user's callback if provided
      options.onAsyncResolved?.(id, data);
    },
  });

  // Build hydration data map
  const data: HydrationData = {};
  for (const { id, data: fragmentData } of resolvedFragments) {
    data[id] = fragmentData;
  }

  // Create script
  const script = createHydrationScript(data);

  // Handle inline mode
  if (scriptPlacement === 'inline') {
    return { html, script, data };
  }

  // No data to inject
  if (!script) {
    return html;
  }

  // Inject script into HTML
  if (scriptPlacement === 'head') {
    return html.replace('</head>', `${script}</head>`);
  }

  // Default: body
  return html.replace('</body>', `${script}</body>`);
}
