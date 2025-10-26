/**
 * RefSpec-based reconciliation for reactive arrays
 *
 * This provides reconciliation utilities that work with RefSpecs (with keys)
 * instead of being tied to fragment implementations. Enables user-space
 * reactive helpers using the closure pattern.
 */

import type { RefSpec, NodeRef, ElementRef, FragmentRef } from '../types';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { LatticeContext } from '../context';
import type { CreateScopes } from './scope';
import { isElementRef, isFragmentRef } from '../types';

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
 * Positional item - tracks RefSpec identity for reuse
 */
export interface PositionalItem<TElement> {
  refSpec: RefSpec<TElement>;
  nodeRef: NodeRef<TElement>;
}

/**
 * State container for reconciliation (stored in closure)
 */
export interface ReconcileState<TElement> {
  // Key-based lookup for O(1) reconciliation
  itemsByKey: Map<string, ReconcileNode<TElement>>;
  // Parent element reference
  parentElement: TElement;
  // Parent element ref (needed for fragment attach)
  parentRef?: ElementRef<TElement>;
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
  const newFragments: FragmentRef<TElement>[] = []; // Track new fragments for attach

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

      // Insert into DOM or collect for attach (newly created nodes)
      if (isElementRef(node)) {
        const nextEl = resolveNextElement(nextSibling);
        renderer.insertBefore(parentElement, node.element, nextEl);
      } else if (isFragmentRef(node)) {
        // Fragments need attach() called - collect for later
        newFragments.push(node);
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

  // Build set of LIS positions for O(1) lookup
  const lisPositions = new Set<number>();
  for (let i = 0; i < lisLen; i++) {
    lisPositions.add(newPosBuf[lisBuf[i]!]!);
  }

  // Position phase - reorder based on LIS
  // Process in REVERSE order so each element can insert before the already-positioned next element
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]!;

    if (!lisPositions.has(node.position)) {
      // Not in LIS - needs repositioning
      // Insert before the next element (which has already been positioned since we're going backwards)
      if (isElementRef(node)) {
        const el = node.element;

        // Find insertion point: the element immediately after this one in final order
        let insertBeforeEl: TElement | null = null;

        if (i + 1 < nodes.length) {
          // Look for next element in nodes array
          const nextNode = nodes[i + 1]!;
          if (isElementRef(nextNode)) {
            insertBeforeEl = nextNode.element;
          }
        }

        // If no next element, insert before boundary marker
        if (!insertBeforeEl) {
          insertBeforeEl = resolveNextElement(nextSibling);
        }

        // Insert the element
        renderer.insertBefore(parentElement, el, insertBeforeEl);
      }
    }
    // Elements in LIS don't need to move - they're already in correct relative positions
  }

  // Attach phase - attach fragments with correct nextSibling (backward pass like processChildren)
  // Walk nodes in reverse order to determine correct insertion points
  if (newFragments.length > 0 && state.parentRef) {
    let nextRef: NodeRef<TElement> | null = nextSibling || null;

    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i]!;

      if (isFragmentRef(node) && newFragments.includes(node)) {
        // New fragment - attach it with correct nextSibling
        node.attach(state.parentRef, nextRef as ElementRef<TElement> | null);
      } else if (isElementRef(node)) {
        // Track last element seen for fragments before it
        nextRef = node;
      }
    }
  }

  return nodes;
}

/**
 * Reconcile RefSpecs positionally (no keys, simpler algorithm)
 *
 * Tracks RefSpec identity to avoid unnecessary re-creation.
 * Only calls create() when RefSpec instance changes or is new.
 */
export function reconcilePositional<
  TElement extends RendererElement,
  TText extends TextNode
>(
  refSpecs: RefSpec<TElement>[],
  state: ReconcileState<TElement> & { itemsByIndex: PositionalItem<TElement>[] },
  ctx: LatticeContext,
  renderer: Renderer<TElement, TText>,
  disposeScope: CreateScopes['disposeScope']
): NodeRef<TElement>[] {
  const { itemsByIndex, parentElement, nextSibling } = state;
  const maxLen = Math.max(refSpecs.length, itemsByIndex.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < refSpecs.length && i < itemsByIndex.length) {
      // Both exist - check if RefSpec changed
      const oldItem = itemsByIndex[i]!;
      const newRefSpec = refSpecs[i]!;

      if (oldItem.refSpec === newRefSpec) {
        // Same RefSpec instance - reuse nodeRef without calling create()
        // This is the critical optimization: avoid re-creating DOM elements
        continue;
      }

      // Different RefSpec - need to replace element
      const oldNodeRef = oldItem.nodeRef;

      // Dispose old element
      if (isElementRef(oldNodeRef)) {
        const oldElement = oldNodeRef.element;
        const scope = ctx.elementScopes.get(oldElement);
        if (scope) {
          disposeScope(scope);
          ctx.elementScopes.delete(oldElement);
        }
        renderer.removeChild(parentElement, oldElement);
      }

      // Create new element from new RefSpec
      const newNodeRef = newRefSpec.create();
      itemsByIndex[i] = { refSpec: newRefSpec, nodeRef: newNodeRef };

      // Insert new element into DOM
      if (isElementRef(newNodeRef)) {
        const nextEl = resolveNextElement(nextSibling);
        renderer.insertBefore(parentElement, newNodeRef.element, nextEl);
      }
    } else if (i < refSpecs.length) {
      // New item - create node
      const refSpec = refSpecs[i]!;
      const nodeRef = refSpec.create();

      itemsByIndex[i] = { refSpec, nodeRef };

      if (isElementRef(nodeRef)) {
        const nextEl = resolveNextElement(nextSibling);
        renderer.insertBefore(parentElement, nodeRef.element, nextEl);
      }
    } else {
      // Old node - remove
      const oldItem = itemsByIndex[i]!;
      const nodeRef = oldItem.nodeRef;

      if (isElementRef(nodeRef)) {
        const scope = ctx.elementScopes.get(nodeRef.element);
        if (scope) {
          disposeScope(scope);
          ctx.elementScopes.delete(nodeRef.element);
        }
        renderer.removeChild(parentElement, nodeRef.element);
      }
    }
  }

  // Trim array to new length
  itemsByIndex.length = refSpecs.length;

  // Return just the nodeRefs for compatibility
  return itemsByIndex.map(item => item.nodeRef);
}
