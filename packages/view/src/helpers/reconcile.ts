/**
 * RefSpec-based reconciliation for reactive arrays
 *
 * This provides reconciliation utilities that work with RefSpecs (with keys)
 * instead of being tied to fragment implementations. Enables user-space
 * reactive helpers using the closure pattern.
 */

import type { RefSpec, NodeRef } from '../types';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { LatticeContext } from '../context';
import type { CreateScopes } from './scope';
import { isElementRef } from '../types';

// Status bits for reconciliation (separate from STATUS_ELEMENT/STATUS_FRAGMENT)
const UNVISITED = 0;
const VISITED = 1;

/**
 * Node state for reconciliation - extends NodeRef with reconciliation metadata
 */
export type ReconcileNode<TElement> = NodeRef<TElement> & {
  key: string;
  position: number;
  reconcileStatus: typeof UNVISITED | typeof VISITED; // Separate from status field
};

/**
 * State container for reconciliation (stored in closure)
 */
export interface ReconcileState<TElement> {
  // Key-based lookup for O(1) reconciliation
  itemsByKey: Map<string, ReconcileNode<TElement>>;
  // Parent element reference
  parentElement: TElement;
  // Next sibling boundary marker
  nextSibling?: NodeRef<TElement>;
}

/**
 * Binary search for LIS algorithm
 */
function binarySearch(
  arr: number[],
  tails: number[],
  len: number,
  value: number
): number {
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
}

/**
 * Find Longest Increasing Subsequence (LIS) using patience sorting
 * O(n log n) algorithm
 */
export function findLIS(arr: number[], n: number, lisBuf: number[]): number {
  if (n <= 0) return 0;
  if (n === 1) {
    lisBuf[0] = 0;
    return 1;
  }

  const tailsBuf: number[] = [];
  const parentBuf: number[] = [];
  let len = 0;

  // Forward phase: build tails and parent pointers
  for (let i = 0; i < n; i++) {
    const pos = binarySearch(arr, tailsBuf, len, arr[i]!);
    parentBuf[i] = pos > 0 ? tailsBuf[pos - 1]! : -1;
    tailsBuf[pos] = i;
    if (pos === len) len++;
  }

  // Backtrack phase: reconstruct LIS
  for (let i = len - 1, current = tailsBuf[i]!; i >= 0; i--) {
    lisBuf[i] = current;
    current = parentBuf[current]!;
  }

  return len;
}

/**
 * Resolve the next DOM element for insertion
 */
function resolveNextElement<TElement>(
  nextSibling: NodeRef<TElement> | undefined
): TElement | null {
  let current = nextSibling;
  while (current) {
    if (isElementRef(current)) return current.element;
    // Fragment - try first child
    if ('firstChild' in current && current.firstChild) {
      current = current.firstChild;
      continue;
    }
    // Empty fragment - skip to next
    current = current.next;
  }
  return null;
}

/**
 * Reconcile RefSpecs with keys using LIS-based algorithm
 *
 * Adapted from map.ts reconcileList, but works with RefSpec arrays
 * instead of being tied to MapFragRef
 */
export function reconcileWithKeys<
  TElement extends RendererElement,
  TText extends TextNode
>(
  refSpecs: RefSpec<TElement>[],
  state: ReconcileState<TElement>,
  ctx: LatticeContext,
  renderer: Renderer<TElement, TText>,
  disposeScope: CreateScopes['disposeScope'],
  oldIndicesBuf: number[],
  newPosBuf: number[],
  lisBuf: number[]
): NodeRef<TElement>[] {
  const { itemsByKey, parentElement, nextSibling } = state;

  // Clear pooled buffers
  oldIndicesBuf.length = 0;
  newPosBuf.length = 0;
  lisBuf.length = 0;

  const nodes: ReconcileNode<TElement>[] = Array(refSpecs.length);

  // Build phase - create/update nodes
  let count = 0;
  for (let i = 0; i < refSpecs.length; i++) {
    const refSpec = refSpecs[i]!;
    const key = refSpec.key !== undefined ? String(refSpec.key) : String(i);

    let node = itemsByKey.get(key);

    if (node) {
      // Existing node - reuse it, don't call create() again
      oldIndicesBuf[count] = node.position;
      newPosBuf[count] = i;
      count++;
      node.position = i;
      node.reconcileStatus = VISITED;
    } else {
      // New node - create from RefSpec
      const nodeRef = refSpec.create() as ReconcileNode<TElement>;
      nodeRef.key = key;
      nodeRef.position = i;
      nodeRef.reconcileStatus = VISITED;

      node = nodeRef;
      itemsByKey.set(key, node);

      // Insert into DOM (newly created nodes)
      if (isElementRef(node)) {
        const nextEl = resolveNextElement(nextSibling);
        renderer.insertBefore(parentElement, node.element, nextEl);
      }
    }

    nodes[i] = node;
  }

  // Prune phase - remove unvisited nodes
  for (const [key, node] of itemsByKey) {
    if (node.reconcileStatus === UNVISITED) {
      // Dispose scope and remove from DOM
      if (isElementRef(node)) {
        const scope = ctx.elementScopes.get(node.element);
        if (scope) {
          disposeScope(scope);
          ctx.elementScopes.delete(node.element);
        }
        renderer.removeChild(parentElement, node.element);
      }

      itemsByKey.delete(key);
    } else {
      node.reconcileStatus = UNVISITED; // Reset for next reconciliation
    }
  }

  // Calculate LIS for minimal moves
  const lisLen = findLIS(oldIndicesBuf, count, lisBuf);
  let lisIdx = 0;
  let nextLISPos = lisLen > 0 ? newPosBuf[lisBuf[0]!]! : -1;

  // Position phase - reorder based on LIS
  // Find the first LIS element to use as initial anchor
  let anchor: TElement | null = resolveNextElement(nextSibling);
  if (lisLen > 0) {
    const firstLISPos = newPosBuf[lisBuf[0]!]!;
    const firstLISNode = nodes[firstLISPos]!;
    if (isElementRef(firstLISNode)) {
      anchor = firstLISNode.element;
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;

    if (node.position === nextLISPos) {
      // In LIS - already in correct relative position
      lisIdx++;
      nextLISPos = lisIdx < lisLen ? newPosBuf[lisBuf[lisIdx]!]! : -1;
      // Update anchor to next LIS element if available
      if (lisIdx < lisLen) {
        const nextLISNodePos = newPosBuf[lisBuf[lisIdx]!]!;
        const nextLISNode = nodes[nextLISNodePos]!;
        if (isElementRef(nextLISNode)) {
          anchor = nextLISNode.element;
        }
      } else {
        anchor = resolveNextElement(nextSibling);
      }
    } else {
      // Not in LIS - needs repositioning before anchor
      if (isElementRef(node)) {
        renderer.insertBefore(parentElement, node.element, anchor);
      }
    }
  }

  return nodes;
}

/**
 * Reconcile RefSpecs positionally (no keys, simpler algorithm)
 *
 * Adapted from map.ts reconcilePositional
 */
export function reconcilePositional<
  TElement extends RendererElement,
  TText extends TextNode
>(
  refSpecs: RefSpec<TElement>[],
  state: ReconcileState<TElement> & { itemsByIndex: NodeRef<TElement>[] },
  ctx: LatticeContext,
  renderer: Renderer<TElement, TText>,
  disposeScope: CreateScopes['disposeScope']
): NodeRef<TElement>[] {
  const { itemsByIndex, parentElement, nextSibling } = state;
  const maxLen = Math.max(refSpecs.length, itemsByIndex.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < refSpecs.length && i < itemsByIndex.length) {
      // Both exist - check if we need to replace
      const oldNode = itemsByIndex[i]!;
      const refSpec = refSpecs[i]!;

      // Create new node to compare
      // Note: In tests with createRefSpec, this returns the same element if unchanged
      // In real usage, this creates a new element, so we compare elements to detect changes
      const newNode = refSpec.create();

      // Check if element actually changed by comparing references
      const oldElement = isElementRef(oldNode) ? oldNode.element : null;
      const newElement = isElementRef(newNode) ? newNode.element : null;

      if (oldElement === newElement) {
        // Same element - reuse, no need to update DOM
        // (This happens when RefSpec wraps same element, like in tests)
        continue;
      }

      // Different element - need to replace
      if (oldElement) {
        const scope = ctx.elementScopes.get(oldElement);
        if (scope) {
          disposeScope(scope);
          ctx.elementScopes.delete(oldElement);
        }
        renderer.removeChild(parentElement, oldElement);
      }

      // Insert new element
      itemsByIndex[i] = newNode;
      if (newElement) {
        const nextEl = resolveNextElement(nextSibling);
        renderer.insertBefore(parentElement, newElement, nextEl);
      }
    } else if (i < refSpecs.length) {
      // New item - create node
      const refSpec = refSpecs[i]!;
      const nodeRef = refSpec.create();

      itemsByIndex[i] = nodeRef;

      if (isElementRef(nodeRef)) {
        const nextEl = resolveNextElement(nextSibling);
        renderer.insertBefore(parentElement, nodeRef.element, nextEl);
      }
    } else {
      // Old node - remove
      const node = itemsByIndex[i]!;

      if (isElementRef(node)) {
        const scope = ctx.elementScopes.get(node.element);
        if (scope) {
          disposeScope(scope);
          ctx.elementScopes.delete(node.element);
        }
        renderer.removeChild(parentElement, node.element);
      }
    }
  }

  // Trim array to new length
  itemsByIndex.length = refSpecs.length;
  return itemsByIndex;
}
