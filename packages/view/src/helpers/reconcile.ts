import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { ViewContext } from '../context';
import type { DeferredListNode, ListItemNode } from '../types';
import { disposeScope } from './scope';
import { appendChild, removeChild, moveChild } from './list-edges';

export function createReconciler() {
  // Closure-captured reusable buffers (grow automatically, zero allocations after first use)
  const oldIndicesBuf: number[] = [];
  const newPosBuf: number[] = [];
  const lisBuf: number[] = [];
  const tailsBuf: number[] = [];
  const parentBuf: number[] = [];

  /**
   * Binary search for largest index where arr[tails[i]] < value
   * tails array contains indices into arr
   */
  const binarySearch = (arr: number[], tails: number[], len: number, value: number): number => {
    let lo = 0;
    let hi = len - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (arr[tails[mid]!]! < value) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return lo;
  };

  /**
   * Inline O(n log n) LIS using patience sorting
   * Returns length and writes indices to lisBuf
   */
  const findLIS = (arr: number[], n: number): number => {
    if (n === 0) return 0;
    if (n === 1) {
      lisBuf[0] = 0;
      return 1;
    }

    // Buffers grow automatically via assignment

    let len = 0;

    for (let i = 0; i < n; i++) {
      const value = arr[i]!;
      const pos = binarySearch(arr, tailsBuf, len, value);

      parentBuf[i] = pos > 0 ? tailsBuf[pos - 1]! : -1;
      tailsBuf[pos] = i;

      if (pos === len) len++;
    }

    // Backtrack to build LIS indices (lisBuf grows automatically)
    let current = tailsBuf[len - 1]!;
    for (let i = len - 1; i >= 0; i--) {
      lisBuf[i] = current;
      current = parentBuf[current]!;
    }

    return len;
  };

  /**
   * Reconcile list with minimal allocations
   */
  function reconcileList<T, TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode>(
    ctx: ViewContext,
    parent: DeferredListNode<TElement>,
    oldHead: ListItemNode<T, TElement> | undefined,
    newItems: T[],
    renderItem: (item: T) => TElement,
    keyFn: (item: T) => string | number,
    renderer: Renderer<TElement, TText>
  ): void {

    const container = parent.element;

    if (!container) return; // No parent yet

    const itemsByKey = parent.itemsByKey as Map<string, ListItemNode<T, TElement>>;

    // Phase 1: Build oldPos map by traversing linked list (plain object for speed)
    const oldPos = Object.create(null) as Record<string, number>;
    let i = 0;
    let current = oldHead;
    while (current) {
      // Cast for ts—we accept string|num|symbol but ts doesn't like that.
      const key = keyFn(current.itemData) as string;
      oldPos[key] = i;
      i++;
      current = current.nextSibling as ListItemNode<T, TElement> | undefined;
    }

    // Phase 2: Build compacted arrays + newKeys lookup (single loop!)
    // Buffers grow automatically via assignment
    let count = 0;
    const newKeys = Object.create(null) as Record<string, boolean>;

    for (let i = 0; i < newItems.length; i++) {
      const key = keyFn(newItems[i]!) as string;
      newKeys[key] = true; // Track which keys should exist

      const pos = oldPos[key];
      if (pos !== undefined) {
        oldIndicesBuf[count] = pos;
        newPosBuf[count] = i;
        count++;
      }
    }

    // Phase 3: Remove items not in newKeys
    for (const [key, node] of itemsByKey) {
      if (!newKeys[key]) {
        const scope = ctx.elementScopes.get(node.element);
        if (scope) {
          disposeScope(scope);
          ctx.elementScopes.delete(node.element);
        }

        // Remove from list structure
        if (node.parentList) {
          removeChild(node);
        }

        // Remove from renderer
        renderer.removeChild(container, node.element);
        itemsByKey.delete(key);
      }
    }

    // Phase 4: Find LIS (inline O(n log n))
    const lisLen = findLIS(oldIndicesBuf, count);

    // Phase 5: Position items
    let lisIdx = 0;
    let nextLISPos = lisIdx < lisLen ? newPosBuf[lisBuf[lisIdx]!]! : -1;
    let prevNode: ListItemNode<T, TElement> | undefined = undefined;

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      if (item === undefined) continue;

      const key = keyFn(item) as string;
      let node = itemsByKey.get(key);

      // Create or reuse node
      if (!node) {
        const element = renderItem(item);
        node = itemsByKey.get(key);

        if (!node) {
          // Create new ListItemNode
          node = {
            refType: 0, // Will be set by ViewNode if needed
            key,
            element,
            itemData: item,
            parentList: undefined,
            previousSibling: undefined,
            nextSibling: undefined,
          };
          itemsByKey.set(key, node);
        }

        // Append to parent
        appendChild(parent, node);

        // Also append to DOM
        renderer.appendChild(container, element);
        // Update data
      } else if (node.itemData !== item) {
        node.itemData = item;
        if (node.itemSignal) node.itemSignal(item);
      }

      const element = node.element;

      // Check if in LIS
      if (i === nextLISPos) {
        lisIdx++;
        nextLISPos = lisIdx < lisLen ? newPosBuf[lisBuf[lisIdx]!]! : -1;
        // Move if not in LIS
      } else if (node.parentList) {
        // Calculate reference sibling (next position in list)
        const refSibling = (prevNode ? prevNode.nextSibling : parent.firstChild) as ListItemNode<T, TElement>;

        // Only move if not already in correct position
        if (node !== refSibling) {
          // Move in list structure
          moveChild(node, refSibling);

          // Move in DOM
          const nextElement = refSibling ? refSibling.element : null;

          if (element !== nextElement) renderer.insertBefore(container, element, nextElement);
        }
      }

      prevNode = node;
    }
  }

  return reconcileList;
}

/**
 * Get first child element using DOM properties
 */
function getFirstElement<T extends object>(container: T): T | null {
  return (container as unknown as { firstChild: T | null }).firstChild;
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
