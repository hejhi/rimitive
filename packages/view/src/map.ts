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
  FragmentRef,
  LifecycleCallback,
  NodeRef,
} from './types';
import { STATUS_FRAGMENT, resolveNextRef } from './types';
import type {
  Renderer,
  Element as RendererElement,
  TextNode,
} from './renderer';
import type { LatticeContext } from './context';
import { CreateScopes } from './helpers/scope';

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
// Map-specific extension fields (what you pass to create)
export type MapItemExt<T> = {
  key: string; // Unique key for reconciliation
  position: number; // Current position in list (cached for LIS algorithm)
  itemData: T; // The actual data
  itemSignal?: ((value: T) => void) & (() => T); // Writable signal for reactivity
  status: number; // Reconciliation status bits (VISITED, UNVISITED) - overrides STATUS_ELEMENT
};


export type ListItemNode<TElement, T = unknown> = Omit<NodeRef<TElement>, 'status'> & MapItemExt<T>;

/**
 * Options passed to map factory
 */
export type MapOpts<
  TElement extends RendererElement = RendererElement,
  TText extends TextNode = TextNode,
> = {
  ctx: LatticeContext;
  signal: <T>(value: T) => Reactive<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
  trackInSpecificScope: CreateScopes['trackInSpecificScope'];
  disposeScope: CreateScopes['disposeScope'];
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
    ) => RefSpec<TElement>
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
export interface MapFragRef<TElement> extends FragmentRef<TElement> {
  // Parent element (stored locally for reconciliation since attach only receives element)
  element: TElement | null;

  // Key-based lookup for O(1) reconciliation during diffing
  // (DOM uses array-based childNodes, we use Map for key lookup)
  itemsByKey: Map<string, ListItemNode<TElement, unknown>>;
}

/**
 * Create the map primitive factory
 */
export function createMapFactory<
  TElement extends RendererElement = RendererElement,
  TText extends TextNode = TextNode,
>(opts: MapOpts<TElement, TText>): MapFactory<TElement> {
  const { ctx, signal, effect, renderer, trackInSpecificScope, disposeScope } = opts;

  function map<T>(
    itemsSignal: Reactive<T[]>,
    render: (itemSignal: Reactive<T>) => RefSpec<TElement>,
    keyFn: (item: T) => string | number
  ): RefSpec<TElement> {
    let dispose: (() => void) | undefined;
    const lifecycleCallbacks: LifecycleCallback<TElement>[] = [];

    const refSpec: RefSpec<TElement> = (
      lifecycleCallback: LifecycleCallback<TElement>
    ): RefSpec<TElement> => {
      lifecycleCallbacks.push(lifecycleCallback);
      return refSpec; // Chainable
    };

    // Pooled buffers for LIS calculation - reused across reconciliations
    const oldIndicesBuf: number[] = [];
    const newPosBuf: number[] = [];
    const lisBuf: number[] = [];

    refSpec.create = <TExt>(extensions?: TExt): MapFragRef<TElement> & TExt => {
      const state: MapFragRef<TElement> = {
        status: STATUS_FRAGMENT,
        element: null,
        itemsByKey: new Map<string, ListItemNode<TElement, unknown>>(),
        prev: undefined,
        next: undefined,
        firstChild: undefined,
        lastChild: undefined,
        ...extensions, // Spread extensions to override/add fields
        attach: (parent, nextSibling): void => {
          // Store parent element for reconciliation (extract from parent NodeRef)
          state.element = parent.element;

          // Store boundary marker if provided (for standalone usage)
          // When created via el(), state.next will be set and takes precedence
          if (nextSibling && !state.next) {
            state.next = nextSibling;
          }

          // Create an effect that reconciles the list when items change
          // Effect automatically schedules via scheduler (like signals/effect.ts)
          dispose = effect(() => {
            const currentItems = itemsSignal();

            // Clear pooled buffers before reuse
            oldIndicesBuf.length = 0;
            newPosBuf.length = 0;
            lisBuf.length = 0;

            // Pass linked list head directly to reconciler (single source of truth)
            // This eliminates array allocation and prevents sync bugs
            reconcileList<T, TElement, TText>(
              ctx,
              state,
              currentItems,
              (itemData: T) => {
                // Render callback returns RefSpec and itemSignal
                // Reconciler will call create() with ListItemNode extensions
                const itemSignal = signal(itemData);
                const refSpec = render(itemSignal);

                return {
                  refSpec, // Return RefSpec, not created NodeRef
                  itemSignal,
                };
              },
              keyFn,
              renderer,
              oldIndicesBuf,
              newPosBuf,
              lisBuf,
              disposeScope
            );
          });

          const parentScope = ctx.elementScopes.get(parent);
          if (parentScope) trackInSpecificScope(parentScope, { dispose });
        },
      };

      return state as MapFragRef<TElement> & TExt;
    };

    return refSpec;
  }

  return {
    name: 'map',
    method: map,
  };
}

// Status bits for reconciliation - simplified 2-state model
const UNVISITED = 0;  // Node not in current newItems (will be pruned)
const VISITED = 1;    // Node exists in newItems (keep)

/**
 * Binary search for largest index where arr[tails[i]] < value
 * tails array contains indices into arr
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
};

/**
 * Inline O(n log n) LIS using patience sorting
 * Returns length and writes indices to lisBuf
 * Single loop with forward pass followed by backtrack phase
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

  // Backtrack phase: reconstruct LIS using parent chain
  for (let i = len - 1, current = tailsBuf[i]!; i >= 0; i--) {
    lisBuf[i] = current;
    current = parentBuf[current]!;
  }

  return len;
};

/**
 * Remove a node and clean up all associated resources
 * Inline helper for pruning unvisited nodes
 */
function pruneNode<T, TElement extends RendererElement, TText extends TextNode>(
  parent: MapFragRef<TElement>,
  node: ListItemNode<TElement, T>,
  ctx: LatticeContext,
  container: TElement,
  itemsByKey: Map<string, ListItemNode<TElement, T>>,
  renderer: Renderer<TElement, TText>,
  disposeScope: CreateScopes['disposeScope']
): void {
  const element = node.element;
  if (!element) return;
  const scope = ctx.elementScopes.get(element);
  if (scope) {
    disposeScope(scope);
    ctx.elementScopes.delete(element);
  }

  removeChild(parent, node);
  renderer.removeChild(container, element);
  itemsByKey.delete(node.key);
}

/**
 * Reconcile list with minimal allocations
 *
 * 3-phase algorithm:
 * 1. Build: Create/update nodes, mark VISITED, collect LIS data
 * 2. Prune: Remove UNVISITED nodes, reset VISITED → UNVISITED inline
 * 3. Position: LIS-based repositioning (no status checks)
 *
 * Buffers are passed in and reused across reconciliations
 */
export function reconcileList<
  T,
  TElement extends RendererElement = RendererElement,
  TText extends TextNode = TextNode,
>(
  ctx: LatticeContext,
  parent: MapFragRef<TElement>,
  newItems: T[],
  renderItem: (item: T) => {
    refSpec: RefSpec<TElement>;
    itemSignal?: ((value: T) => void) & (() => T);
  },
  keyFn: (item: T) => string | number,
  renderer: Renderer<TElement, TText>,
  oldIndicesBuf: number[],
  newPosBuf: number[],
  lisBuf: number[],
  disposeScope: CreateScopes['disposeScope']
): void {
  const parentEl = parent.element;
  if (!parentEl) return;

  const itemsByKey = parent.itemsByKey as Map<
    string,
    ListItemNode<TElement, T>
  >;

  // Pre-allocate nodes buffer to avoid Map lookup in position phase
  const nodes: ListItemNode<TElement, T>[] = Array(
    newItems.length
  ) as ListItemNode<TElement, T>[];

  // Build phase - create/update nodes and collect LIS info
  let count = 0;
  for (let i = 0; i < newItems.length; i++) {
    const item = newItems[i]!;
    const key = keyFn(item) as string;
    let ref: ListItemNode<TElement, T> = itemsByKey.get(key)!;

    if (ref) {
      // Existing node - collect for LIS
      oldIndicesBuf[count] = ref.position;
      newPosBuf[count] = i;
      count++;

      ref.position = i;
      ref.status = VISITED;

      // Update data
      if (ref.itemData !== item) {
        ref.itemData = item;
        if (ref.itemSignal) ref.itemSignal(item);
      }
    } else {
      // New node - create and insert
      const rendered = renderItem(item);

      ref = rendered.refSpec.create<MapItemExt<T>>({
        key,
        itemData: item,
        itemSignal: rendered.itemSignal,
        position: i,
        status: VISITED,
      }) as ListItemNode<TElement, T>;

      insertBefore(parent, ref);
      itemsByKey.set(key, ref);
      const el = ref.element;

      if (!el) return;
      renderer.insertBefore(
        parentEl,
        el,
        resolveNextRef(parent.next)?.element ?? null
      );
    }

    nodes[i] = ref;
  }

  // Prune phase - remove all unvisited nodes before repositioning
  let child = parent.firstChild as ListItemNode<TElement, T> | undefined;
  while (child) {
    const nextChild = child.next as ListItemNode<TElement, T>;
    if (child.status === UNVISITED) {
      pruneNode(parent, child, ctx, parentEl, itemsByKey, renderer, disposeScope);
    } else {
      // Reset visited nodes inline (avoid second traversal)
      child.status = UNVISITED;
    }
    child = nextChild;
  }

  // Calculate LIS
  const lisLen = findLIS(oldIndicesBuf, count, lisBuf);
  let lisIdx = 0;
  let nextLISPos = lisLen > 0 ? newPosBuf[lisBuf[0]!]! : -1;

  // Positioning phase - reorder nodes based on LIS (all stale nodes already removed)
  let prevNode: ListItemNode<TElement, T> | undefined;
  for (const node of nodes) {
    if (node.position === nextLISPos) {
      // In LIS - already in correct relative position
      lisIdx++;
      nextLISPos = lisIdx < lisLen ? newPosBuf[lisBuf[lisIdx]!]! : -1;
    } else {
      // Not in LIS - needs repositioning
      const refSibling = (prevNode ? prevNode.next : parent.firstChild) as ListItemNode<TElement, T>;

      if (node !== refSibling) {
        moveChild(parent, node, refSibling);

        const nextEl = refSibling ? refSibling.element : resolveNextRef(parent.next)?.element ?? null;
        const nodeElement = node.element;
        if (nodeElement && nodeElement !== nextEl) {
          renderer.insertBefore(parentEl, nodeElement, nextEl);
        }
      }
    }
    prevNode = node;
  }
}

/**
 * Unlink a node from parent's children list
 */
function unlinkFromParent<T, TElement>(
  parent: MapFragRef<TElement>,
  node: ListItemNode<TElement, T>
): void {
  const { prev: prevSibling, next: nextSibling } = node;

  if (nextSibling != undefined) nextSibling.prev = prevSibling;
  else parent.lastChild = prevSibling;

  if (prevSibling != undefined) prevSibling.next = nextSibling;
  else parent.firstChild = nextSibling;
}

/**
 * Insert node before refSibling (or at end if refSibling is undefined)
 * Like DOM insertBefore
 */
function insertBefore<T, TElement>(
  parent: MapFragRef<TElement>,
  node: ListItemNode<TElement, T>,
  refSibling?: ListItemNode<TElement, T> | undefined
): void {
  const typedNode = node as NodeRef<TElement>;

  if (refSibling === undefined) {
    // Insert at end
    const prevSibling = parent.lastChild;
    typedNode.prev = prevSibling;
    typedNode.next = undefined;

    if (prevSibling != undefined) prevSibling.next = typedNode;
    else parent.firstChild = typedNode;

    parent.lastChild = typedNode;
  } else {
    // Insert before refSibling
    const prevSibling = refSibling.prev;
    typedNode.prev = prevSibling;
    typedNode.next = refSibling as NodeRef<TElement>;

    refSibling.prev = typedNode;

    if (prevSibling != undefined) prevSibling.next = typedNode;
    else parent.firstChild = typedNode;
  }
}


/**
 * Remove a node from the list
 */
function removeChild<T, TElement>(
  parent: MapFragRef<TElement>,
  node: ListItemNode<TElement, T>
): void {
  unlinkFromParent(parent, node);
  node.prev = undefined;
  node.next = undefined;
}

/**
 * Move a node to a new position (before refSibling)
 */
function moveChild<T, TElement>(
  parent: MapFragRef<TElement>,
  node: ListItemNode<TElement, T>,
  refSibling: ListItemNode<TElement, T> | undefined
): void {
  unlinkFromParent(parent, node);
  insertBefore(parent, node, refSibling);
}
