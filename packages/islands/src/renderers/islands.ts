/**
 * Hydrating Renderer
 *
 * Delegates to a hydrating renderer initially, then switches to a fallback
 * renderer after hydration completes.
 *
 * This solves the problem where reactive updates after hydration would still
 * use the hydrating renderer, causing HydrationMismatch errors.
 */

import type { Renderer, NodeRef } from '@lattice/view/types';
import type { DOMRendererConfig } from './dom-hydration';

/**
 * Create a hydrating renderer that switches to a fallback after hydration is complete
 */
export function createIslandsRenderer(
  hydrateRenderer: Renderer<DOMRendererConfig>,
  fallbackRenderer: Renderer<DOMRendererConfig>
): Renderer<DOMRendererConfig> & { switchToFallback: () => void } {
  let useHydrating = true;

  const switchToFallback = () => (useHydrating = false);
  const getRenderer = (): Renderer<DOMRendererConfig> =>
    useHydrating ? hydrateRenderer : fallbackRenderer;

  return {
    createNode: (type: string, props?: Record<string, unknown>) =>
      getRenderer().createNode(type, props),
    setProperty: (node: Node, key: string, value: unknown) =>
      getRenderer().setProperty(node, key, value),
    appendChild: (parent, child) => getRenderer().appendChild(parent, child),
    removeChild: (parent, child) => getRenderer().removeChild(parent, child),
    insertBefore: (parent, newNode, refNode) =>
      getRenderer().insertBefore(parent, newNode, refNode),
    // Forward lifecycle hooks (new unified API)
    beforeCreate: (type: string, props?: Record<string, unknown>) =>
      getRenderer().beforeCreate?.(type, props),
    onCreate: (ref: NodeRef<Node>, parent: Node) =>
      getRenderer().onCreate?.(ref, parent),
    beforeAttach: (ref: NodeRef<Node>, parent: Node, nextSibling: Node | null) =>
      getRenderer().beforeAttach?.(ref, parent, nextSibling),
    onAttach: (ref: NodeRef<Node>, parent: Node) =>
      getRenderer().onAttach?.(ref, parent),
    beforeDestroy: (ref: NodeRef<Node>, parent: Node) =>
      getRenderer().beforeDestroy?.(ref, parent),
    onDestroy: (ref: NodeRef<Node>, parent: Node) =>
      getRenderer().onDestroy?.(ref, parent),
    switchToFallback,
  };
}
