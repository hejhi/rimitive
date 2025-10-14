import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { ViewContext } from '../context';
import { disposeScope } from './scope';

/**
 * ALGORITHM: LIS-based List Reconciliation with Minimal Allocations
 *
 * Optimizations inspired by signals patterns:
 * - Closure-captured reusable buffers (grow once per size increase)
 * - O(n log n) LIS using patience sorting + binary search
 * - Track newKeys during compaction (no map rebuild)
 * - Inline calculations to reduce function call overhead
 *
 * Complexity: O(n log n) time, O(n) space (reused buffers)
 */

/**
 * Metadata for a list item
 */
interface ItemNode<T, TElement = object> {
  key: string;
  element: TElement;
  itemData: T;
  itemSignal?: ((value: T) => void) & (() => T);
}

/**
 * Create reconciler with closure-captured buffers
 * PATTERN: Like signals createScheduler/createGraphEdges
 */
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
    container: TElement,
    oldItems: T[],
    newItems: T[],
    itemMap: Map<string, ItemNode<T, TElement>>,
    renderItem: (item: T) => TElement,
    keyFn: (item: T) => string | number,
    renderer: Renderer<TElement, TText>
  ): void {
    // Early bailout
    if (oldItems === newItems) return;

    const newLen = newItems.length;
    const oldLen = oldItems.length;

    if (newLen === 0 && oldLen === 0) return;

    // Phase 1: Build oldPos map (plain object for speed)
    const oldPos: Record<string, number> = Object.create(null);
    for (let i = 0; i < oldLen; i++) {
      const key = String(keyFn(oldItems[i]!));
      oldPos[key] = i;
    }

    // Phase 2: Build compacted arrays AND track newKeys
    // Buffers grow automatically via assignment
    let count = 0;
    const newKeys: Record<string, boolean> = Object.create(null);

    for (let i = 0; i < newLen; i++) {
      const key = String(keyFn(newItems[i]!));
      newKeys[key] = true; // Track for removal phase

      const pos = oldPos[key];
      if (pos !== undefined) {
        oldIndicesBuf[count] = pos;
        newPosBuf[count] = i;
        count++;
      }
    }

    // Phase 3: Find LIS (inline O(n log n))
    const lisLen = findLIS(oldIndicesBuf, count);

    // Phase 4: Position items
    let lisIdx = 0;
    let nextLISPos = lisIdx < lisLen ? newPosBuf[lisBuf[lisIdx]!]! : -1;
    let prevElement: TElement | null = null;

    for (let i = 0; i < newLen; i++) {
      const item = newItems[i];
      if (item === undefined) continue;

      const key = String(keyFn(item));
      let node = itemMap.get(key);

      // Create or reuse node
      if (!node) {
        const element = renderItem(item);
        node = itemMap.get(key);
        if (!node) {
          node = { key, element, itemData: item };
          itemMap.set(key, node);
        }
      } else {
        // Update data
        if (node.itemData !== item) {
          node.itemData = item;
          if (node.itemSignal) node.itemSignal(item);
        }
      }

      const element = node.element;

      // Check if in LIS
      const inLIS = i === nextLISPos;
      if (inLIS) {
        lisIdx++;
        nextLISPos = lisIdx < lisLen ? newPosBuf[lisBuf[lisIdx]!]! : -1;
      }

      // Move if not in LIS
      if (!inLIS) {
        const next: TElement | null = prevElement
          ? getNextElement(prevElement)
          : getFirstElement(container);

        if (element !== next) {
          renderer.insertBefore(container, element, next);
        }
      }

      prevElement = element;
    }

    // Phase 5: Remove items not in newKeys (no rebuild!)
    for (const [key, node] of itemMap) {
      if (!newKeys[key]) {
        const scope = ctx.elementScopes.get(node.element);
        if (scope) {
          disposeScope(scope);
          ctx.elementScopes.delete(node.element);
        }
        renderer.removeChild(container, node.element);
        itemMap.delete(key);
      }
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
 * Get next sibling element using DOM properties
 */
function getNextElement<T extends object>(element: T): T | null {
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
