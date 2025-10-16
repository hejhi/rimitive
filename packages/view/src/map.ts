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
  ElementRef,
  MapFragment,
  ListItemNode,
} from './types';
import { FRAGMENT, type MapFragmentState } from './types';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';
import { createReconciler } from './helpers/reconcile';
import type { ViewContext } from './context';

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
export type MapFactory<TElement extends RendererElement = RendererElement> = LatticeExtension<
  'map',
  <T>(
    itemsSignal: Reactive<T[]>,
    render: (itemSignal: Reactive<T>) => ElementRef,
    keyFn: (item: T) => string | number
  ) => MapFragment<TElement>
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
    render: (itemSignal: Reactive<T>) => ElementRef<TElement>,
    keyFn: (item: T) => string | number
  ): MapFragment<TElement> {
    let dispose: (() => void) | undefined;

    const node: MapFragmentState<TElement> = {
      refType: FRAGMENT,
      element: null,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, TElement>>(),
    };

    // Create ref function that closes over node (like signal function)
    const mapFragment = ((parent: TElement): void => {
      // Store parent in node
      node.element = parent;

      // Create an effect that reconciles the list when items change
      // Effect automatically schedules via scheduler (like signals/effect.ts)
      dispose = effect(() => {
        const currentItems = itemsSignal();

        // Pass linked list head directly to reconciler (single source of truth)
        // This eliminates array allocation and prevents sync bugs
        reconcileList<T, TElement, TText>(
          ctx,
          node,  // ← Pass MapFragmentState directly
          currentItems,
          (itemData: T) => {
            // Render callback only creates DOM element
            // Reconciler will wrap it in ListItemNode
            const itemSignal = signal(itemData);
            const elementRef = render(itemSignal);

            return {
              element: elementRef.create(),
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
    }) as MapFragment<TElement>;

    // Attach refType to fragment (type discrimination)
    mapFragment.refType = FRAGMENT;

    return mapFragment;
  }

  return {
    name: 'map',
    method: map as MapFactory<TElement>['method'],
  };
}
