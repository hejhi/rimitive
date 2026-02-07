/**
 * Async HTML rendering for SSR.
 *
 * Resolves all async fragments (load() boundaries) before returning HTML.
 * Uses renderToString for final serialization and resolveAllAsyncFragments
 * for pipelined async resolution.
 */

import type { NodeRef, FragmentRef, RefSpec } from '@rimitive/view/types';
import { STATUS_ELEMENT, STATUS_FRAGMENT } from '@rimitive/view/types';
import {
  ASYNC_FRAGMENT,
  isAsyncFragment,
  type AsyncFragment,
} from '../shared/async-fragments';
import type { Serialize } from './parse5-adapter';
import { renderToString } from './render-to-string';
import { resolveAllAsyncFragments } from './resolve-fragments';

/**
 * Anything that can be rendered asynchronously: a mounted NodeRef,
 * an unresolved AsyncFragment, or an unmounted RefSpec.
 */
export type AsyncRenderable<TElement> =
  | NodeRef<TElement>
  | AsyncFragment<TElement>
  | RefSpec<TElement>;

/**
 * Options for renderToStringAsync.
 */
export type RenderToStringAsyncOptions<TSvc> = {
  /** The composed service instance */
  svc: TSvc;
  /** Mount function to create NodeRef from RefSpec */
  mount: (spec: RefSpec<unknown>) => NodeRef<unknown>;
  /** Function to serialize elements to HTML (from createParse5Adapter) */
  serialize: Serialize;
  /** Function to insert fragment markers (from createParse5Adapter) */
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
 * which causes the reactive content to update in-place.
 *
 * After all resolves complete, fragment markers are inserted around
 * the final resolved content using tree traversal. The parentElement
 * is derived from firstNode.parentNode since content is already in the DOM.
 * This ensures markers wrap the correct content, not the initial pending state.
 *
 * @example
 * ```ts
 * const { adapter, serialize, insertFragmentMarkers } = createParse5Adapter();
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

  const processedFragments = await resolveAllAsyncFragments(nodeRef);

  // Insert markers for async fragments AFTER all resolves complete
  // This ensures markers wrap the final resolved content, not the initial pending state
  // parentElement is derived from the DOM tree via firstNode.parentNode
  for (const fragment of processedFragments) {
    // load() always creates a fragment wrapper, so async fragments are always FragmentRefs
    if (fragment.status === STATUS_FRAGMENT) insertFragmentMarkers(fragment);
  }

  return renderToString(nodeRef, serialize);
}
