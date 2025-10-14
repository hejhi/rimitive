/**
 * Reactive list primitive
 *
 * elMap() creates a reactive list that efficiently updates the DOM when items
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
  DeferredListRef,
} from './types';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';
import { createReconciler } from './helpers/reconcile';
import type { ViewContext } from './context';

/**
 * Options passed to elMap factory
 */
export type ElMapOpts<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode> = {
  ctx: ViewContext;
  signal: <T>(value: T) => Reactive<T>;
  effect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
};

/**
 * Factory return type
 */
export type ElMapFactory<TElement extends RendererElement = RendererElement> = LatticeExtension<
  'elMap',
  <T>(
    itemsSignal: Reactive<T[]>,
    render: (itemSignal: Reactive<T>) => ElementRef<TElement>,
    keyFn: (item: T) => string | number
  ) => DeferredListRef<TElement>
>;

/**
 * Item node metadata
 */
interface ItemNode<T, TElement = object> {
  key: string;
  element: TElement;
  itemData: T;
  itemSignal: Reactive<T> & ((value: T) => void); // Writable signal
}

/**
 * Create the elMap primitive factory
 */
export function createElMapFactory<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode>(
  opts: ElMapOpts<TElement, TText>
): ElMapFactory<TElement> {
  const { ctx, signal, effect, renderer } = opts;

  // PATTERN: Create reconciler once with closure-captured buffers (like signals)
  const reconcileList = createReconciler();

  function elMap<T>(
    itemsSignal: Reactive<T[]>,
    render: (itemSignal: Reactive<T>) => ElementRef<TElement>,
    keyFn: (item: T) => string | number
  ): DeferredListRef<TElement> {
    // Track items by key
    const itemMap = new Map<string, ItemNode<T, TElement>>();
    let previousItems: T[] = [];
    let dispose: (() => void) | undefined;

    // Create the deferred list ref - a callable that receives parent element
    const deferredRef = ((parent: TElement): void => {
      // Create an effect that reconciles the list when items change
      // PATTERN: Effect automatically schedules via scheduler (like signals/effect.ts)
      dispose = effect(() => {
        const currentItems = itemsSignal();

        reconcileList<T, TElement, TText>(
          ctx,
          parent,  // ← Use parent directly, no wrapper!
          previousItems,
          currentItems,
          itemMap,
          (item: T) => {
            // PATTERN: Create signal once and reuse (like graph-edges.ts reuses deps)
            // This signal will be updated by reconcileList when item data changes
            const itemSignal = signal(item);

            // Render the item using the provided render function
            const elementRef = render(itemSignal);

            // Store item metadata including signal for updates
            const key = String(keyFn(item));
            itemMap.set(key, {
              key,
              element: elementRef.element,
              itemData: item,
              itemSignal
            });

            return elementRef.element;
          },
          keyFn,
          renderer
        );

        // Update previous items for next reconciliation
        previousItems = currentItems;
      });

      // Track dispose in parent's scope
      // PATTERN: Parent owns the lifecycle
      const parentScope = ctx.elementScopes.get(parent);
      if (parentScope) {
        const disposeNode = {
          disposable: { dispose },
          next: parentScope.firstDisposable,
        };
        parentScope.firstDisposable = disposeNode;
      }
    }) as DeferredListRef<TElement>;

    // Mark as deferred list for type checking
    deferredRef.__type = 'deferred-list';

    return deferredRef;
  }

  return {
    name: 'elMap',
    method: elMap,
  };
}
