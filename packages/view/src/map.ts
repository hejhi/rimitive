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
      keyFn?: (item: T) => string | number
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

  // Key-based lookup for O(1) reconciliation during diffing (when keyFn provided)
  // (DOM uses array-based childNodes, we use Map for key lookup)
  itemsByKey?: Map<string, ListItemNode<TElement, unknown>>;

  // Positional array for index-based reconciliation (when no keyFn)
  itemsByIndex?: ListItemNode<TElement, unknown>[];
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
    keyFn?: (item: T) => string | number
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
        // Initialize storage based on reconciliation mode
        ...(keyFn
          ? { itemsByKey: new Map<string, ListItemNode<TElement, unknown>>() }
          : { itemsByIndex: [] as ListItemNode<TElement, unknown>[] }
        ),
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

            const renderCallback = (itemData: T) => {
              // Render callback returns RefSpec and itemSignal
              // Reconciler will call create() with ListItemNode extensions
              const itemSignal = signal(itemData);
              const refSpec = render(itemSignal);

              return {
                refSpec, // Return RefSpec, not created NodeRef
                itemSignal,
              };
            };

            // Dispatch to appropriate reconciliation strategy
            if (keyFn) {
              // Key-based reconciliation with LIS
              reconcileList<T, TElement, TText>(
                ctx,
                state,
                currentItems,
                renderCallback,
                keyFn,
                renderer,
                oldIndicesBuf,
                newPosBuf,
                lisBuf,
                disposeScope
              );
            } else {
              // Positional reconciliation (simpler, no reordering)
              reconcilePositional<T, TElement, TText>(
                ctx,
                state,
                currentItems,
                renderCallback,
                renderer,
                disposeScope
              );
            }
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
}

/**
 * Reconcile list positionally (without keys)
 * Simple index-based reconciliation: reuse nodes at same index
 */
function reconcilePositional<
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
  renderer: Renderer<TElement, TText>,
  disposeScope: CreateScopes['disposeScope']
): void {
  const parentEl = parent.element;
  if (!parentEl) return;

  const oldNodes = parent.itemsByIndex ?? [];
  const maxLen = Math.max(newItems.length, oldNodes.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < newItems.length && i < oldNodes.length) {
      // Both exist - update existing node
      const node = oldNodes[i]!;
      const item = newItems[i]!;

      if (node.itemData !== item) {
        node.itemData = item;
        if (node.itemSignal) node.itemSignal(item);
      }
    } else if (i < newItems.length) {
      // New item - create node
      const item = newItems[i]!;
      const rendered = renderItem(item);

      const ref = rendered.refSpec.create<MapItemExt<T>>({
        key: String(i),
        itemData: item,
        itemSignal: rendered.itemSignal,
        position: i,
        status: VISITED,
      }) as ListItemNode<TElement, T>;

      insertBefore(parent, ref);
      oldNodes[i] = ref;

      if (ref.element) {
        renderer.insertBefore(
          parentEl,
          ref.element,
          resolveNextRef(parent.next)?.element ?? null
        );
      }
    } else {
      // Old node - remove
      const node = oldNodes[i]!;

      if (node.element) {
        const scope = ctx.elementScopes.get(node.element);
        if (scope) {
          disposeScope(scope);
          ctx.elementScopes.delete(node.element);
        }
        renderer.removeChild(parentEl, node.element);
      }

      unlinkFromParent(parent, node);
      node.prev = undefined;
      node.next = undefined;
    }
  }

  // Trim array to new length
  oldNodes.length = newItems.length;
}

/**
 * Reconcile list with minimal allocations (key-based)
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
  const elRefs: ListItemNode<TElement, T>[] = Array(
    newItems.length
  ) as ListItemNode<TElement, T>[];

  // Build phase - create/update nodes and collect LIS info
  let count = 0;
  for (let i = 0; i < newItems.length; i++) {
    const item = newItems[i]!;
    const key = keyFn(item) as string;
    let ref: ListItemNode<TElement, T> = itemsByKey.get(key)!;

    build: if (ref) {
      // Existing node - collect for LIS
      oldIndicesBuf[count] = ref.position;
      newPosBuf[count] = i;
      count++;
      ref.position = i;
      ref.status = VISITED;

      // Update data
      if (ref.itemData === item) break build;

      ref.itemData = item;
      if (ref.itemSignal) ref.itemSignal(item);
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
      const rEl = ref.element;

      if (rEl == undefined) break build;

      renderer.insertBefore(
        parentEl,
        rEl,
        resolveNextRef(parent.next)?.element ?? null
      );
    }

    elRefs[i] = ref;
  }

  // Prune phase - remove unvisited nodes and reset visited → unvisited
  let child = parent.firstChild as ListItemNode<TElement, T> | undefined;
  while (child) {
    const next = child.next as ListItemNode<TElement, T>;

    if (child.status === UNVISITED) {
      // Dispose scope and DOM element
      const el = child.element;
      if (el) {
        const scope = ctx.elementScopes.get(el);
        if (scope) {
          disposeScope(scope);
          ctx.elementScopes.delete(el);
        }
        renderer.removeChild(parentEl, el);
      }

      // Remove from linked list
      unlinkFromParent(parent, child);
      child.prev = undefined;
      child.next = undefined;
      itemsByKey.delete(child.key);
    } else child.status = UNVISITED;

    child = next;
  }

  // Calculate LIS
  const lisLen = findLIS(oldIndicesBuf, count, lisBuf);
  let lisIdx = 0;
  let nextLISPos = lisLen > 0 ? newPosBuf[lisBuf[0]!]! : -1;

  // Positioning phase - reorder nodes based on LIS
  let prev: ListItemNode<TElement, T> | undefined;
  for (const ref of elRefs) {
    if (ref.position === nextLISPos) {
      // In LIS - already in correct relative position
      lisIdx++;
      nextLISPos = lisIdx < lisLen ? newPosBuf[lisBuf[lisIdx]!]! : -1;
    } else {
      // Not in LIS - needs repositioning
      const sib = (prev?.next ?? parent.firstChild) as ListItemNode<TElement, T> | undefined;

      mv: if (ref !== sib) {
        unlinkFromParent(parent, ref);
        insertBefore(parent, ref, sib);

        const el = ref.element;

        if (!el) break mv;

        const nextEl = sib?.element
          ?? resolveNextRef(parent.next)?.element
          ?? null;

        if (el === nextEl) break mv;

        renderer.insertBefore(parentEl, el, nextEl);
      }
    }
    prev = ref;
  }
}

/**
 * Unlink node from parent's children list
 */
function unlinkFromParent<T, TElement>(
  parent: MapFragRef<TElement>,
  node: ListItemNode<TElement, T>
): void {
  const { prev, next } = node;

  if (next != undefined) next.prev = prev;
  else parent.lastChild = prev;

  if (prev != undefined) prev.next = next;
  else parent.firstChild = next;
}

/**
 * Insert ref before refSib (or at end)
 */
function insertBefore<T, TElement>(
  parent: MapFragRef<TElement>,
  ref: ListItemNode<TElement, T>,
  next: ListItemNode<TElement, T> | null = null
): void {
  const tRef = ref as NodeRef<TElement>;
  const prev = next ? next.prev : parent.lastChild;

  tRef.prev = prev;
  tRef.next = next as NodeRef<TElement> | undefined;

  if (next != undefined) next.prev = tRef;
  else parent.lastChild = tRef;

  if (prev != undefined) prev.next = tRef;
  else parent.firstChild = tRef;
}
