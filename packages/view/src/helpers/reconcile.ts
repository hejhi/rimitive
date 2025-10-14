import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { ViewContext } from '../context';
import { disposeScope } from './scope';

/**
 * Metadata for a list item
 */
interface ItemNode<T, TElement = object> {
  key: unknown;      // Extracted key (via keyFn or identity)
  element: TElement;
  itemData: T;       // The actual data object
  itemSignal?: ((value: T) => void) & (() => T);  // Optional writable signal
}

/**
 * Reconcile a list of items against existing DOM nodes
 *
 * @param ctx - View context for accessing element metadata
 * @param container - Parent element containing the list
 * @param oldItems - Previous array of items
 * @param newItems - New array of items
 * @param itemMap - Map from key to ItemNode
 * @param renderItem - Function to render a new item
 * @param keyFn - Function to extract key from item (defaults to identity)
 * @param renderer - Renderer for DOM operations
 */
export function reconcileList<T, TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode>(
  ctx: ViewContext,
  container: TElement,
  oldItems: T[],
  newItems: T[],
  itemMap: Map<unknown, ItemNode<T, TElement>>,
  renderItem: (item: T) => TElement,
  keyFn: (item: T) => unknown = (item) => item,
  renderer: Renderer<TElement, TText>
): void {
  // Build key sets for fast lookup
  const newKeys = new Set(newItems.map(keyFn));

  // Phase 1: Remove items that no longer exist
  for (const item of oldItems) {
    const key = keyFn(item);
    if (!newKeys.has(key)) {
      const node = itemMap.get(key);
      if (node) {
        // ALGORITHMIC: Dispose via scope tree walk
        const scope = ctx.elementScopes.get(node.element);
        if (scope) {
          disposeScope(scope);
          ctx.elementScopes.delete(node.element);
        }
        // Remove from DOM
        renderer.removeChild(container, node.element);
        itemMap.delete(key);
      }
    }
  }

  // Phase 2: Add new items and reorder existing ones
  let previousElement: TElement | null = null;

  for (let i = 0; i < newItems.length; i++) {
    const item = newItems[i];
    if (item === undefined) continue;

    const key = keyFn(item);
    let node = itemMap.get(key);

    // Create new item if it doesn't exist
    if (!node) {
      const element = renderItem(item);
      // IMPORTANT: renderItem may have already set itemMap with itemSignal
      // Don't overwrite it - just fetch the node that was stored
      node = itemMap.get(key);
      if (!node) {
        // Fallback: renderItem didn't set the map (non-elMap usage)
        node = {
          key,
          element,
          itemData: item
        };
        itemMap.set(key, node);
      }
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
    // We rely on DOM structure for positioning since elements maintain their order
    let nextElement: TElement | null;
    if (previousElement) {
      // Get the next sibling of the previous element
      nextElement = getNextElement(previousElement);
    } else {
      // This is the first element, get the first child of container
      nextElement = getFirstElement(container);
    }

    // Skip DOM operation if element is already in the right spot
    if (element !== nextElement) {
      // Element needs to be moved or inserted
      renderer.insertBefore(container, element, nextElement);
    }

    previousElement = element;
  }
}

/**
 * Get first child element using DOM properties
 */
function getFirstElement<T extends object>(container: T): T | null {
  // Cast to access DOM properties - assumes DOM-like structure
  return (container as unknown as { firstChild: T | null }).firstChild;
}

/**
 * Get next sibling element using DOM properties
 */
function getNextElement<T extends object>(element: T): T | null {
  // Cast to access DOM properties - assumes DOM-like structure
  return (element as unknown as { nextSibling: T | null }).nextSibling;
}

/**
 * Simple reconciliation for cases where we can just replace all children
 * (useful for small lists or initial render)
 */
export function replaceChildren<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode>(
  ctx: ViewContext,
  container: TElement,
  elements: TElement[],
  renderer: Renderer<TElement, TText>
): void {
  // Clear existing children
  let firstChild = getFirstElement(container);
  while (firstChild) {
    // ALGORITHMIC: Dispose via scope tree walk
    const scope = ctx.elementScopes.get(firstChild);
    if (scope) {
      disposeScope(scope);
      ctx.elementScopes.delete(firstChild);
    }
    renderer.removeChild(container, firstChild);
    firstChild = getFirstElement(container);
  }

  // Add new children
  for (const element of elements) {
    renderer.appendChild(container, element);
  }
}
