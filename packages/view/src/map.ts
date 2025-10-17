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
import type { Reactive, RefSpec, Fragment } from './types';
import { FRAGMENT } from './types';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';
import { createReconciler, ListItemNode, MapFragmentState } from './helpers/reconcile';
import type { ViewContext } from './context';

/**
 * Map fragment state - created by map()
 * Fragment that manages parent→children list relationship
 *
 * Maintains head/tail of children like DOM ParentNode:
 * - firstChild ↔ firstChild
 * - lastChild ↔ lastChild
 * - childNodes ↔ itemsByKey (Map is for efficient key lookup, DOM uses array)
 */
export interface MapState<TElement> extends MapFragmentState<TElement | null> {
  refType: typeof FRAGMENT;
  element: TElement | null; // Parent element (null until fragment attached)

  // DOM-like children list (intrusive doubly-linked list)
  firstChild: ListItemNode<unknown, TElement> | undefined;  // Like DOM firstChild
  lastChild: ListItemNode<unknown, TElement> | undefined;   // Like DOM lastChild

  // Key-based lookup for O(1) reconciliation during diffing
  // (DOM uses array-based childNodes, we use Map for key lookup)
  itemsByKey: Map<string, ListItemNode<unknown, TElement>>;

  // Boundary marker for stable positioning (like match fragment)
  nextSibling: TElement | null; // Element after this fragment's territory
}

/**
 * Options passed to map factory
 */
export type MapOpts<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode> = {
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
    ) => Fragment<TElement>
  >;


/**
 * Create the map primitive factory
 */
export function createMapFactory<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode>(
  opts: MapOpts<TElement, TText>
): MapFactory<TElement> {
  const { ctx, signal, effect, renderer } = opts;

  // Create reconciler once with closure-captured buffers (like signals)
  const { reconcileList } = createReconciler();

  function map<T>(
    itemsSignal: Reactive<T[]>,
    render: (itemSignal: Reactive<T>) => RefSpec<TElement>,
    keyFn: (item: T) => string | number
  ): Fragment<TElement> {
    let dispose: (() => void) | undefined;

    const state: MapState<TElement> = {
      refType: FRAGMENT,
      element: null,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, TElement>>(),
      nextSibling: null,
    };

    // Create ref function that closes over node (like signal function)
    const mapFragment = ((
      parent: TElement,
      nextSibling?: TElement | null
    ): void => {
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

      // Track dispose in parent's scope
      // Parent owns the lifecycle
      const parentScope = ctx.elementScopes.get(parent);
      if (parentScope) {
        const disposeNode = {
          disposable: { dispose },
          next: parentScope.firstDisposable,
        };
        parentScope.firstDisposable = disposeNode;
      }
    }) as Fragment<TElement>;

    // Attach refType to fragment (type discrimination)
    mapFragment.refType = FRAGMENT;

    return mapFragment;
  }

  return {
    name: 'map',
    method: map as unknown as MapFactory<TElement>['method'],
  };
}
