import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { ViewContext } from '../context';
import type { DeferredListNode, ListItemNode } from '../types';
import { disposeScope } from './scope';
import { appendChild, removeChild, moveChild } from './list-edges';

// Status bits for reconciliation (like signals CLEAN/DIRTY/PENDING)
const VISITED = 1 << 0;  // Node exists in newItems array

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
   * Single loop with forward pass followed by backtrack phase
   */
  const findLIS = (arr: number[], n: number): number => {
    if (n <= 0) return 0;
    if (n === 1) {
      lisBuf[0] = 0;
      return 1;
    }

    let len = 0;
    let depth = 0;

    for (;;) {
      // Forward phase: build tails and parent pointers
      if (depth < n) {
        const pos = binarySearch(arr, tailsBuf, len, arr[depth]!);

        parentBuf[depth] = pos > 0 ? tailsBuf[pos - 1]! : -1;
        tailsBuf[pos] = depth;

        if (pos === len) len++;
        depth++;
        continue;
      }

      depth = len - 1;
      let current = tailsBuf[depth]!;
  
      // Backtrack phase: reconstruct LIS using parent chain
      do {
        lisBuf[depth] = current;
        current = parentBuf[current]!;
      } while (depth--);
  
      return len;
    }
  };

  /**
   * Remove a node and clean up all associated resources
   * Inline helper for pruning unvisited nodes
   */
  const pruneNode = <T, TElement extends RendererElement>(
    node: ListItemNode<T, TElement>,
    ctx: ViewContext,
    container: TElement,
    itemsByKey: Map<string, ListItemNode<T, TElement>>,
    renderer: Renderer<TElement, any>
  ): void => {
    const scope = ctx.elementScopes.get(node.element);
    if (scope) {
      disposeScope(scope);
      ctx.elementScopes.delete(node.element);
    }

    removeChild(node);
    renderer.removeChild(container, node.element);
    itemsByKey.delete(node.key);
  };

  /**
   * Reconcile list with minimal allocations
   * PATTERN: Reordered loops - position first, then remove
   * Eliminates newKeys allocation by using status bits
   */
  function reconcileList<T, TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode>(
    ctx: ViewContext,
    parent: DeferredListNode<TElement>,
    newItems: T[],
    renderItem: (item: T) => { element: TElement; itemSignal?: ((value: T) => void) & (() => T) },
    keyFn: (item: T) => string | number,
    renderer: Renderer<TElement, TText>
  ): void {
    const container = parent.element;
    if (!container) return;

    const itemsByKey = parent.itemsByKey as Map<string, ListItemNode<T, TElement>>;

    // Loop 1: Build LIS arrays
    let count = 0;

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      if (item === undefined) continue;

      const key = keyFn(item) as string;
      let node = itemsByKey.get(key);

      if (node) {
        oldIndicesBuf[count] = node.position;
        newPosBuf[count] = i;
        count++;
        // Mark existing node as visited
        node.status |= VISITED;

        // Update data
        if (node.itemData !== item) {
          node.itemData = item;
          if (node.itemSignal) node.itemSignal(item);
        }
      } else {
        // Create new node
        const rendered = renderItem(item);

        node = {
          refType: 0,
          key,
          element: rendered.element,
          itemData: item,
          itemSignal: rendered.itemSignal,
          position: i,
          status: VISITED, // Mark as visited on creation
          parentList: undefined,
          previousSibling: undefined,
          nextSibling: undefined,
        };

        appendChild(parent, node);
        itemsByKey.set(key, node);
        renderer.appendChild(container, rendered.element);
      }
    }

    // Calculate LIS
    const lisLen = findLIS(oldIndicesBuf, count);

    // Loop 2: Position items + mark as visited
    let lisIdx = 0;
    let nextLISPos = lisIdx < lisLen ? newPosBuf[lisBuf[lisIdx]!]! : -1;
    let prevNode: ListItemNode<T, TElement> | undefined = undefined;

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      if (item === undefined) continue;

      const key = keyFn(item) as string;
      const node = itemsByKey.get(key);

      if (!node) continue;

      const element = node.element;

      // Check if in LIS
      if (i === nextLISPos) {
        lisIdx++;
        nextLISPos = lisIdx < lisLen ? newPosBuf[lisBuf[lisIdx]!]! : -1;
      } else if (node.parentList) {
        // Calculate reference sibling for insertion
        let refSibling = (prevNode ? prevNode.nextSibling : parent.firstChild) as ListItemNode<T, TElement> | undefined;

        // Remove any unvisited nodes at the insertion point (cleanup as we go)
        while (refSibling && !(refSibling.status & VISITED)) {
          const nextRef = refSibling.nextSibling as ListItemNode<T, TElement> | undefined;
          pruneNode(refSibling, ctx, container, itemsByKey, renderer);
          refSibling = nextRef;
        }

        // Move if not in LIS and not already in correct position
        if (node !== refSibling) {
          moveChild(node, refSibling);

          const nextElement = refSibling ? refSibling.element : null;
          if (element !== nextElement) renderer.insertBefore(container, element, nextElement);
        }
      }

      node.position = i;
      prevNode = node;
    }

    // Loop 3: Remove any remaining unvisited nodes (cleanup stragglers)
    let current = parent.firstChild as ListItemNode<T, TElement> | undefined;

    while (current) {
      const next = current.nextSibling as ListItemNode<T, TElement> | undefined;

      if (!(current.status & VISITED)) pruneNode(current, ctx, container, itemsByKey, renderer);
      else current.status = 0;

      current = next;
    }
  }

  return {
    reconcileList,
    findLIS,
  };
}
