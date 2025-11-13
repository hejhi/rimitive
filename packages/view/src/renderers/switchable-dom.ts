/**
 * Switchable DOM Renderer
 *
 * Starts in hydration mode (matching existing DOM) and switches to
 * regular creation mode after initial render completes.
 *
 * This solves the problem where reactive updates after hydration
 * would still use the hydrating renderer, causing HydrationMismatch errors.
 */

import type { Renderer } from '../renderer';
import { createHydratingDOMRenderer, type DOMRendererConfig } from './hydrating-dom';
import { createDOMRenderer } from './dom';

/**
 * Create a switchable DOM renderer
 *
 * @param containerEl - Container element to hydrate initially
 * @returns Renderer that starts in hydration mode and can switch to regular mode
 *
 * @example
 * ```ts
 * const container = document.getElementById('counter-0');
 * const renderer = createSwitchableDOMRenderer(container);
 *
 * // Component hydrates from server HTML
 * const nodeRef = Counter(props).create(api);
 *
 * // Switch to regular mode after hydration
 * renderer.switchToRegularMode();
 *
 * // Future reactive updates use regular DOM creation
 * ```
 */
export function createSwitchableDOMRenderer(
  containerEl: HTMLElement
): Renderer<DOMRendererConfig> & { switchToRegularMode: () => void } {
  let hydratingRenderer: Renderer<DOMRendererConfig> | null = createHydratingDOMRenderer(containerEl);
  let regularRenderer: Renderer<DOMRendererConfig> | null = null;
  let isHydrating = true;

  const switchToRegularMode = () => {
    if (!isHydrating) return;
    isHydrating = false;
    hydratingRenderer = null;
    regularRenderer = createDOMRenderer();
  };

  const getRenderer = (): Renderer<DOMRendererConfig> => {
    if (isHydrating && hydratingRenderer) {
      return hydratingRenderer;
    }
    if (!regularRenderer) {
      regularRenderer = createDOMRenderer();
    }
    return regularRenderer;
  };

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
    switchToRegularMode,
  };
}
