/**
 * Reactive list primitive
 *
 * map creates a reactive list that efficiently updates the DOM when items
 * are added, removed, or reordered. It uses identity-based tracking by default
 * (no keys required), but supports an optional key function for cases where
 * data objects are recreated.
 *
 * Each item is wrapped in a signal that the render function receives. This
 * allows fine-grained reactivity within each item's DOM.
 */

import type { LatticeExtension } from '@lattice/lattice';
import type {
  Reactive,
  RefSpec,
  FragmentSpec,
  ReactiveElement,
} from './types';
import type {
  Renderer,
  Element as RendererElement,
  TextNode,
} from './renderer';
import type { ViewContext } from './context';
import { disposeScope, trackInSpecificScope } from './helpers/scope';

/**
 * List item node - represents an item in a reactive list
 * Forms intrusive doubly-linked list via sibling pointers
 *
 * Unidirectional edges: parent knows children (via firstChild/lastChild),
 * but children don't know parent. Siblings link to each other.
 *
 * DOM parallel:
 * - previousSibling ↔ previousSibling
 * - nextSibling ↔ nextSibling
 */
export interface ListItemNode<T = unknown, TElement = ReactiveElement> {
  element: TElement; // The underlying element
  key: string; // Unique key for reconciliation
  itemData: T; // The actual data
  itemSignal?: ((value: T) => void) & (() => T); // Writable signal for reactivity
  position: number; // Current position in list (cached for LIS algorithm)
  status: number; // Status bits for reconciliation (VISITED, etc.)

  // Sibling navigation (intrusive linked list - nodes link to siblings only)
  previousSibling: ListItemNode<unknown, TElement> | undefined; // Like DOM previousSibling
  nextSibling: ListItemNode<unknown, TElement> | undefined; // Like DOM nextSibling
}

/**
 * Options passed to map factory
 */
export type MapOpts<
  TElement extends RendererElement = RendererElement,
  TText extends TextNode = TextNode,
> = {
  ctx: ViewContext;
  signal: <T>(value: T) => Reactive<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
};

/**
 * Factory return type
 * Generic over element type - instantiate with specific renderer element type
 * Example: MapFactory<HTMLElement> for DOM
 */
export type MapFactory<TElement extends RendererElement = RendererElement> =
  LatticeExtension<
    'map',
    <T>(
      itemsSignal: Reactive<T[]>,
      render: (itemSignal: Reactive<T>) => RefSpec<TElement>,
      keyFn: (item: T) => string | number
    ) => FragmentSpec<TElement>
  >;


/**
 * Map fragment state - created by map()
 * Fragment that manages parent→children list relationship
 *
 * Maintains head/tail of children like DOM ParentNode:
 * - firstChild ↔ firstChild
 * - lastChild ↔ lastChild
 * - childNodes ↔ itemsByKey (Map is for efficient key lookup, DOM uses array)
 */
export interface MapState<TElement> {
  element: TElement | null; // Parent element (null until fragment attached)

  // DOM-like children list (intrusive doubly-linked list)
  firstChild: ListItemNode<unknown, TElement> | undefined; // Like DOM firstChild
  lastChild: ListItemNode<unknown, TElement> | undefined; // Like DOM lastChild

  // Key-based lookup for O(1) reconciliation during diffing
  // (DOM uses array-based childNodes, we use Map for key lookup)
  itemsByKey: Map<string, ListItemNode<unknown, TElement>>;

  // Boundary marker for stable positioning (like match fragment)
  nextSibling: TElement | null; // Element after this fragment's territory
}

/**
 * Create the map primitive factory
 */
export function createMapFactory<
  TElement extends RendererElement = RendererElement,
  TText extends TextNode = TextNode,
>(opts: MapOpts<TElement, TText>): MapFactory<TElement> {
  const { ctx, signal, effect, renderer } = opts;

  // Create reconciler once with closure-captured buffers (like signals)
  const { reconcileList } = createReconciler();

  function map<T>(
    itemsSignal: Reactive<T[]>,
    render: (itemSignal: Reactive<T>) => RefSpec<TElement>,
    keyFn: (item: T) => string | number
  ): FragmentSpec<TElement> {
    let dispose: (() => void) | undefined;

    // internal
    const state: MapState<TElement> = {
      element: null,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, TElement>>(),
      nextSibling: null,
    };

    // Return fragment with attach method
    return {
      attach: (parent: TElement, nextSibling?: TElement | null): void => {
        // Store parent and nextSibling boundary marker
        state.element = parent;
        state.nextSibling = nextSibling ?? null;

        // Create an effect that reconciles the list when items change
        // Effect automatically schedules via scheduler (like signals/effect.ts)
        dispose = effect(() => {
          const currentItems = itemsSignal();

          // Pass linked list head directly to reconciler (single source of truth)
          // This eliminates array allocation and prevents sync bugs
          reconcileList<T, TElement, TText>(
            ctx,
            state,
            currentItems,
            (itemData: T) => {
              // Render callback only creates DOM element
              // Reconciler will wrap it in ListItemNode
              const itemSignal = signal(itemData);
              const elementRef = render(itemSignal);

              return {
                element: elementRef.create(), // Create returns element directly
                itemSignal,
              };
            },
            keyFn,
            renderer
          );
        });

        const parentScope = ctx.elementScopes.get(parent);
        if (parentScope) trackInSpecificScope(parentScope, { dispose });
      },
    };
  }

  return {
    name: 'map',
    method: map,
  };
}

// Status bits for reconciliation (like signals CLEAN/DIRTY/PENDING)
const VISITED = 1 << 0; // Node exists in newItems array

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
  const binarySearch = (
    arr: number[],
    tails: number[],
    len: number,
    value: number
  ): number => {
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
  const pruneNode = <
    T,
    TElement extends RendererElement,
    TText extends TextNode,
  >(
    parent: MapState<TElement>,
    node: ListItemNode<T, TElement>,
    ctx: ViewContext,
    container: TElement,
    itemsByKey: Map<string, ListItemNode<T, TElement>>,
    renderer: Renderer<TElement, TText>
  ): void => {
    const scope = ctx.elementScopes.get(node.element);
    if (scope) {
      disposeScope(scope);
      ctx.elementScopes.delete(node.element);
    }

    removeChild(parent, node);
    renderer.removeChild(container, node.element);
    itemsByKey.delete(node.key);
  };

  /**
   * Reconcile list with minimal allocations
   * Reordered loops - position first, then remove
   * Eliminates newKeys allocation by using status bits
   */
  function reconcileList<
    T,
    TElement extends RendererElement = RendererElement,
    TText extends TextNode = TextNode,
  >(
    ctx: ViewContext,
    parent: MapState<TElement>,
    newItems: T[],
    renderItem: (item: T) => {
      element: TElement;
      itemSignal?: ((value: T) => void) & (() => T);
    },
    keyFn: (item: T) => string | number,
    renderer: Renderer<TElement, TText>
  ): void {
    const parentEl = parent.element;
    if (!parentEl) return;

    const newLen = newItems.length;
    const itemsByKey = parent.itemsByKey as Map<
      string,
      ListItemNode<T, TElement>
    >;
    const visitedNodesBuf: ListItemNode<T, TElement>[] =
      Array<ListItemNode<T, TElement>>(newLen);

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
          element: rendered.element,
          key,
          itemData: item,
          itemSignal: rendered.itemSignal,
          position: i,
          status: VISITED, // Mark as visited on creation
          previousSibling: undefined,
          nextSibling: undefined,
        };

        appendChild(parent, node);
        itemsByKey.set(key, node);
        // Insert before parent.nextSibling to maintain fragment position
        renderer.insertBefore(parentEl, rendered.element, parent.nextSibling);
      }

      // Collect visited nodes
      visitedNodesBuf[i] = node!;
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
      } else {
        // Node not in LIS - needs repositioning
        // Calculate reference sibling for insertion
        let child = (prevNode ? prevNode.nextSibling : parent.firstChild) as
          | ListItemNode<T, TElement>
          | undefined;

        // Remove any unvisited nodes at the insertion point (cleanup as we go)
        while (child && !(child.status & VISITED)) {
          const nextChild = child.nextSibling as ListItemNode<T, TElement>;
          pruneNode(parent, child, ctx, parentEl, itemsByKey, renderer);
          child = nextChild;
        }

        // Move if not in LIS and not already in correct position
        if (node !== child) {
          moveChild(parent, node, child);

          // Use parent.nextSibling as fallback to maintain fragment position
          const nextEl = child ? child.element : parent.nextSibling;
          if (el !== nextEl) renderer.insertBefore(parentEl, el, nextEl);
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

      if (!(child.status & VISITED))
        pruneNode(parent, child, ctx, parentEl, itemsByKey, renderer);
      else child.status = 0;

      child = nextChild;
    } while (child);
  }

  return {
    reconcileList,
    findLIS,
  };
}

/**
 * Unlink a node from parent's children list
 * Like DOM removeChild internal logic
 */
function unlinkFromParent<T, TElement>(
  parent: MapState<TElement>,
  node: ListItemNode<T, TElement>
): void {
  const { previousSibling, nextSibling } = node;

  // Update next sibling's backward pointer
  if (nextSibling !== undefined) {
    nextSibling.previousSibling = previousSibling;
  } else {
    // This was the last child
    parent.lastChild = previousSibling;
  }

  // Update prev sibling's forward pointer
  if (previousSibling !== undefined) {
    previousSibling.nextSibling = nextSibling;
  } else {
    // This was the first child
    parent.firstChild = nextSibling;
  }
}

/**
 * Append a node to parent's children list
 * Like DOM appendChild
 */
function appendChild<T, TElement>(
  parent: MapState<TElement>,
  node: ListItemNode<T, TElement>
): void {
  // Get current tail for O(1) append
  const prevSibling = parent.lastChild as ListItemNode<T, TElement> | undefined;

  // Wire node into list (unidirectional: parent→child, not child→parent)
  node.previousSibling = prevSibling;
  node.nextSibling = undefined;

  // Update parent's tail pointer
  if (prevSibling !== undefined) {
    prevSibling.nextSibling = node as ListItemNode<unknown, TElement>;
  } else {
    // This is the first child
    parent.firstChild = node as ListItemNode<unknown, TElement>;
  }

  parent.lastChild = node as ListItemNode<unknown, TElement>;
}

/**
 * Remove a node from the list
 * Like DOM removeChild
 */
function removeChild<T, TElement>(
  parent: MapState<TElement>,
  node: ListItemNode<T, TElement>
): void {
  // Unlink from parent's children list
  unlinkFromParent(parent, node);

  // Clear node's sibling references
  node.previousSibling = undefined;
  node.nextSibling = undefined;
}

/**
 * Move a node to a new position (before refSibling)
 * Optimized operation: remove + insert
 * Like moving DOM nodes
 */
function moveChild<T, TElement>(
  parent: MapState<TElement>,
  node: ListItemNode<T, TElement>,
  refSibling: ListItemNode<T, TElement> | undefined
): void {
  // Remove from current position
  unlinkFromParent(parent, node);

  // Insert at new position
  if (refSibling === undefined) {
    // Move to end
    const prevSibling = parent.lastChild as
      | ListItemNode<T, TElement>
      | undefined;
    node.previousSibling = prevSibling;
    node.nextSibling = undefined;

    if (prevSibling !== undefined) {
      prevSibling.nextSibling = node as ListItemNode<unknown, TElement>;
    } else {
      parent.firstChild = node as ListItemNode<unknown, TElement>;
    }

    parent.lastChild = node as ListItemNode<unknown, TElement>;
  } else {
    // Move before refSibling
    const prevSibling = refSibling.previousSibling as
      | ListItemNode<T, TElement>
      | undefined;
    node.previousSibling = prevSibling;
    node.nextSibling = refSibling as ListItemNode<unknown, TElement>;

    refSibling.previousSibling = node as ListItemNode<unknown, TElement>;

    if (prevSibling !== undefined) {
      prevSibling.nextSibling = node as ListItemNode<unknown, TElement>;
    } else {
      parent.firstChild = node as ListItemNode<unknown, TElement>;
    }
  }
}
