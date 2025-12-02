/**
 * Hydrating Adapter
 *
 * Delegates to a hydrating adapter initially, then switches to a fallback
 * adapter after hydration completes.
 *
 * This solves the problem where reactive updates after hydration would still
 * use the hydrating adapter, causing HydrationMismatch errors.
 */

import type { Adapter, NodeRef } from '@lattice/view/types';
import type { DOMAdapterConfig } from './dom-hydration';

/**
 * Create a hydrating adapter that switches to a fallback after hydration is complete
 */
export function createIslandsAdapter(
  hydrateAdapter: Adapter<DOMAdapterConfig>,
  fallbackAdapter: Adapter<DOMAdapterConfig>
): Adapter<DOMAdapterConfig> & { switchToFallback: () => void } {
  let useHydrating = true;

  const switchToFallback = () => (useHydrating = false);
  const getAdapter = (): Adapter<DOMAdapterConfig> =>
    useHydrating ? hydrateAdapter : fallbackAdapter;

  return {
    createNode: (type: string, props?: Record<string, unknown>) =>
      getAdapter().createNode(type, props),
    setProperty: (node: Node, key: string, value: unknown) =>
      getAdapter().setProperty(node, key, value),
    appendChild: (parent, child) => getAdapter().appendChild(parent, child),
    removeChild: (parent, child) => getAdapter().removeChild(parent, child),
    insertBefore: (parent, newNode, refNode) =>
      getAdapter().insertBefore(parent, newNode, refNode),
    // Forward lifecycle hooks (new unified API)
    beforeCreate: (type: string, props?: Record<string, unknown>) =>
      getAdapter().beforeCreate?.(type, props),
    onCreate: (ref: NodeRef<Node>, parent: Node) =>
      getAdapter().onCreate?.(ref, parent),
    beforeAttach: (ref: NodeRef<Node>, parent: Node, nextSibling: Node | null) =>
      getAdapter().beforeAttach?.(ref, parent, nextSibling),
    onAttach: (ref: NodeRef<Node>, parent: Node) =>
      getAdapter().onAttach?.(ref, parent),
    beforeDestroy: (ref: NodeRef<Node>, parent: Node) =>
      getAdapter().beforeDestroy?.(ref, parent),
    onDestroy: (ref: NodeRef<Node>, parent: Node) =>
      getAdapter().onDestroy?.(ref, parent),
    switchToFallback,
  };
}
