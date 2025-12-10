/**
 * Render to string utilities for SSR
 *
 * Renders a node tree to HTML string. Async rendering support allows
 * awaiting load() boundaries before serialization.
 *
 * With the marker-based hydration approach, async fragment data is
 * embedded directly in fragment markers by dom-server.ts, so no
 * separate hydration script is needed for async data.
 */

import type {
  NodeRef,
  ElementRef,
  FragmentRef,
  RefSpec,
} from '@lattice/view/types';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@lattice/view/types';
import {
  ASYNC_FRAGMENT,
  isAsyncFragment,
  collectAsyncFragments,
  type AsyncFragment,
} from './async-fragments';

/**
 * Render a node tree to HTML string
 */
export function renderToString(nodeRef: NodeRef<unknown>): string {
  if (nodeRef.status === STATUS_ELEMENT) return renderElementToString(nodeRef);
  if (nodeRef.status === STATUS_FRAGMENT)
    return renderFragmentToString(nodeRef);
  return '';
}

function renderElementToString(elementRef: ElementRef<unknown>): string {
  const element = elementRef.element as { outerHTML?: string };
  if (typeof element.outerHTML !== 'string') {
    throw new Error(
      'Element does not have outerHTML property. Are you using linkedom renderer?'
    );
  }
  return element.outerHTML;
}

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
// Async Rendering
// =============================================================================

export type AsyncRenderable<TElement> =
  | NodeRef<TElement>
  | AsyncFragment<TElement>
  | RefSpec<TElement>;

export type RenderToStringAsyncOptions<TSvc> = {
  svc: TSvc;
  mount: (spec: RefSpec<unknown>) => NodeRef<unknown>;
};

function isRefSpec(value: unknown): value is RefSpec<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'create' in value &&
    typeof (value as RefSpec<unknown>).create === 'function'
  );
}

function isNodeRef(value: unknown): value is NodeRef<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const status = (value as { status?: number }).status;
  return status === STATUS_ELEMENT || status === STATUS_FRAGMENT;
}

/**
 * Render to string with async support.
 *
 * Resolves all async fragments (load() boundaries) before returning HTML.
 * Each async fragment's resolve() fetches data and updates internal signals,
 * which causes the reactive content to update in-place (via linkedom).
 *
 * Data is embedded in fragment markers by dom-server.ts during onAttach,
 * so no separate hydration script is needed for async data.
 *
 * @example
 * ```ts
 * const html = await renderToStringAsync(appSpec, {
 *   svc: service,
 *   mount: (spec) => spec.create(service),
 * });
 * ```
 */
export async function renderToStringAsync<TSvc>(
  renderable: AsyncRenderable<unknown>,
  options: RenderToStringAsyncOptions<TSvc>
): Promise<string> {
  const { mount } = options;

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

  return renderToString(nodeRef);
}
