/**
 * ALGORITHM: Identity-Based List Reconciliation
 *
 * Efficient DOM updates for reactive lists without requiring explicit keys.
 * Uses object identity (referential equality) to track changes.
 *
 * KEY OPTIMIZATIONS:
 * 1. Reuse existing DOM nodes and signals (avoid allocations)
 * 2. Update signal values in-place (follows signals/graph-edges.ts pattern)
 * 3. Minimize DOM operations (only move when necessary)
 * 4. O(n) reconciliation using Map for O(1) lookups
 *
 * RECONCILIATION PHASES:
 * Phase 1: Remove - Dispose nodes no longer in list
 * Phase 2: Update & Reorder - Update data, create new nodes, reposition all
 */

import type { ReactiveElement } from '../types';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import { elementDisposeCallbacks } from './element-metadata';

/**
 * Metadata for a list item
 */
interface ItemNode<T> {
  key: unknown;      // Extracted key (via keyFn or identity)
  element: ReactiveElement;
  itemData: T;       // The actual data object
  itemSignal?: ((value: T) => void) & (() => T);  // Optional writable signal
}

/**
 * Reconcile a list of items against existing DOM nodes
 *
 * @param container - Parent element containing the list
 * @param oldItems - Previous array of items
 * @param newItems - New array of items
 * @param itemMap - Map from key to ItemNode
 * @param renderItem - Function to render a new item
 * @param keyFn - Function to extract key from item (defaults to identity)
 * @param renderer - Renderer for DOM operations
 */
export function reconcileList<T, TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode>(
  container: ReactiveElement,
  oldItems: T[],
  newItems: T[],
  itemMap: Map<unknown, ItemNode<T>>,
  renderItem: (item: T) => ReactiveElement,
  keyFn: (item: T) => unknown = (item) => item,
  renderer: Renderer<TElement, TText>
): void {
  // Build key sets for fast lookup
  const newKeys = new Set(newItems.map(keyFn));

  // Phase 1: Remove items that no longer exist
  const rendererContainer = container as unknown as TElement;

  for (const item of oldItems) {
    const key = keyFn(item);
    if (!newKeys.has(key)) {
      const node = itemMap.get(key);
      if (node) {
        // Dispose the element's scope
        const dispose = elementDisposeCallbacks.get(node.element);
        if (dispose) {
          dispose();
        }
        // Remove from DOM
        const rendererElement = node.element as unknown as TElement;
        renderer.removeChild(rendererContainer, rendererElement);
        itemMap.delete(key);
      }
    }
  }

  // Phase 2: Add new items and reorder existing ones
  let previousElement: ReactiveElement | null = null;

  for (let i = 0; i < newItems.length; i++) {
    const item = newItems[i];
    if (item === undefined) continue;

    const key = keyFn(item);
    let node = itemMap.get(key);

    // Create new item if it doesn't exist
    if (!node) {
      const element = renderItem(item);
      node = {
        key,
        element,
        itemData: item
      };
      itemMap.set(key, node);
    } else {
      // Update existing item data
      // PATTERN: Reuse existing nodes like signals/graph-edges.ts reuses dependencies
      if (node.itemData !== item) {
        node.itemData = item;

        // Update the item signal if present (elMap stores this)
        if (node.itemSignal && typeof node.itemSignal === 'function') {
          node.itemSignal(item);
        }
      }
    }

    // Position element correctly
    // OPTIMIZATION: Only move if not already in correct position
    const element = node.element;

    // Determine where to insert this element
    let nextElement: ReactiveElement | null;
    if (previousElement) {
      nextElement = getNextSibling(previousElement);
    } else {
      nextElement = getFirstChild(container);
    }

    // Skip DOM operation if element is already in the right spot
    if (element !== nextElement) {
      // Element needs to be moved or inserted
      const rendererElement = element as unknown as TElement;
      const rendererNext = nextElement as unknown as TElement | null;
      renderer.insertBefore(rendererContainer, rendererElement, rendererNext);
    }

    previousElement = element;
  }
}

/**
 * Get first child of a container (typed for renderer operations)
 */
function getFirstChild(container: ReactiveElement): ReactiveElement | null {
  return container.firstChild as ReactiveElement | null;
}

/**
 * Get next sibling of an element (typed for renderer operations)
 */
function getNextSibling(element: ReactiveElement): ReactiveElement | null {
  return element.nextSibling as ReactiveElement | null;
}

/**
 * Simple reconciliation for cases where we can just replace all children
 * (useful for small lists or initial render)
 */
export function replaceChildren<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode>(
  container: ReactiveElement,
  elements: ReactiveElement[],
  renderer: Renderer<TElement, TText>
): void {
  const rendererContainer = container as unknown as TElement;

  // Clear existing children
  while (container.firstChild) {
    const child = container.firstChild as ReactiveElement;
    const dispose = elementDisposeCallbacks.get(child);
    if (dispose) {
      dispose();
    }
    const rendererChild = child as unknown as TElement;
    renderer.removeChild(rendererContainer, rendererChild);
  }

  // Add new children
  for (const element of elements) {
    const rendererElement = element as unknown as TElement;
    renderer.appendChild(rendererContainer, rendererElement);
  }
}
