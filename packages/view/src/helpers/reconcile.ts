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
   * Reordered loops - position first, then remove
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
    const containerEl = parent.element;
    if (!containerEl) return;

    const newLen = newItems.length;
    const itemsByKey = parent.itemsByKey as Map<
      string,
      ListItemNode<T, TElement>
    >;
    const visitedNodesBuf: ListItemNode<T, TElement>[] = Array(newLen);

    // Loop 1: Build LIS arrays + collect visited nodes
    let count = 0;

    for (let i = 0; i < newLen; i++) {
      const item = newItems[i]!;
      const key = keyFn(item) as string;
      let node = itemsByKey.get(key);

      if (node) {
        oldIndicesBuf[count] = node.position;
        newPosBuf[count] = i;
        count++;

        // Update position immediately (old position already cached in oldIndicesBuf)
        node.position = i;

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
        renderer.appendChild(containerEl, rendered.element);
      }

      // Collect visited nodes
      visitedNodesBuf[i] = node;
    }

    // Calculate LIS
    const lisLen = findLIS(oldIndicesBuf, count);

    // Loop 2: Traverse visited nodes and position
    let lisIdx = 0;
    let nextLISPos = lisLen > 0 ? newPosBuf[lisBuf[0]!]! : -1;
    let prevNode: ListItemNode<T, TElement> | undefined;

    for (const node of visitedNodesBuf) {
      const el = node.element;

      // Check if in LIS
      if (node.position === nextLISPos) {
        lisIdx++;
        nextLISPos = lisIdx < lisLen ? newPosBuf[lisBuf[lisIdx]!]! : -1;
      } else if (node.parentList) {
        // Calculate reference sibling for insertion
        let child = (prevNode ? prevNode.nextSibling : parent.firstChild) as
          | ListItemNode<T, TElement>
          | undefined;

        // Remove any unvisited nodes at the insertion point (cleanup as we go)
        while (child && !(child.status & VISITED)) {
          const nextChild = child.nextSibling as | ListItemNode<T, TElement>;
          pruneNode(child, ctx, containerEl, itemsByKey, renderer);
          child = nextChild;
        }

        // Move if not in LIS and not already in correct position
        if (node !== child) {
          moveChild(node, child);

          const nextEl = child ? child.element : null;
          if (el !== nextEl) renderer.insertBefore(containerEl, el, nextEl);
        }
      }

      prevNode = node;
    }

    // Loop 3: Remove any remaining unvisited nodes (cleanup stragglers)
    let child = parent.firstChild;

    if (!child) return;

    do {
      const nextChild = child.nextSibling as
        | ListItemNode<T, TElement>
        | undefined;

      if (!(child.status & VISITED)) pruneNode(child, ctx, containerEl, itemsByKey, renderer);
      else child.status = 0;

      child = nextChild;
    } while (child);
  }

  return {
    reconcileList,
    findLIS,
  };
}
