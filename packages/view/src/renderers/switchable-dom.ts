/**
 * Hydrating Renderer
 *
 * Delegates to a hydrating renderer initially, then switches to a fallback
 * renderer after hydration completes.
 *
 * This solves the problem where reactive updates after hydration would still
 * use the hydrating renderer, causing HydrationMismatch errors.
 */

import type { Renderer } from '../renderer';
import type { DOMRendererConfig } from './hydrating-dom';

/**
 * Create a hydrating renderer that switches to a fallback after hydration is complete
 */
export function createHydratingRenderer(
  hydrateRenderer: Renderer<DOMRendererConfig>,
  fallbackRenderer: Renderer<DOMRendererConfig>
): Renderer<DOMRendererConfig> & { switchToFallback: () => void } {
  let useHydrating = true;

  const switchToFallback = () => (useHydrating = false);
  const getRenderer = (): Renderer<DOMRendererConfig> =>
    useHydrating ? hydrateRenderer : fallbackRenderer;

  return {
    createElement: (tag) => getRenderer().createElement(tag),
    createTextNode: (text) => getRenderer().createTextNode(text),
    updateTextNode: (node, text) => getRenderer().updateTextNode(node, text),
    setAttribute: (element, key, value) => getRenderer().setAttribute(element, key, value),
    appendChild: (parent, child) => getRenderer().appendChild(parent, child),
    removeChild: (parent, child) => getRenderer().removeChild(parent, child),
    insertBefore: (parent, newNode, refNode) => getRenderer().insertBefore(parent, newNode, refNode),
    isConnected: (element) => getRenderer().isConnected(element),
    addEventListener: (element, event, handler, options) => getRenderer().addEventListener(element, event, handler, options),
    switchToFallback,
  };
}
