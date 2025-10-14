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
  LifecycleCallback,
} from './types';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';
import { reconcileList } from './helpers/reconcile';
import type { ViewContext } from './context';
import {
  elementDisposeCallbacks,
  elementLifecycleCallbacks,
  elementCleanupCallbacks,
} from './helpers/element-metadata';

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
    keyFn?: (item: T) => unknown
  ) => ElementRef<TElement>
>;

/**
 * Item node metadata
 */
interface ItemNode<T, TElement = object> {
  key: unknown;
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
  const { signal, effect, renderer } = opts;
  // ctx is passed through but not used directly here
  // It's used by el() when render function is called

  function elMap<T>(
    itemsSignal: Reactive<T[]>,
    render: (itemSignal: Reactive<T>) => ElementRef<TElement>,
    keyFn: (item: T) => unknown = (item) => item
  ): ElementRef<TElement> {
    // Create a container element that will hold the list
    const container = renderer.createElement('div');
    // Set display: contents so container doesn't affect layout
    renderer.setAttribute(container, 'style', { display: 'contents' });

    // Track items by key
    const itemMap = new Map<unknown, ItemNode<T, TElement>>();
    let previousItems: T[] = [];

    // Create an effect that reconciles the list when items change
    // PATTERN: Effect automatically schedules via scheduler (like signals/effect.ts)
    const dispose = effect(() => {
      const currentItems = itemsSignal();

      reconcileList<T, TElement, TText>(
        container,
        previousItems,
        currentItems,
        itemMap,
        (item: T) => {
          // PATTERN: Create signal once and reuse (like graph-edges.ts reuses deps)
          // This signal will be updated by reconcileList when item data changes
          const itemSignal = signal(item) as Reactive<T> & ((value: T) => void);

          // Render the item using the provided render function
          const elementRef = render(itemSignal);

          // Store item metadata including signal for updates
          const key = keyFn(item);
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

    // Store dispose callback in WeakMap
    const containerKey = container as object;
    elementDisposeCallbacks.set(containerKey, () => {
      // Dispose the main effect
      dispose();

      // Call cleanup callback if registered
      const cleanup = elementCleanupCallbacks.get(containerKey);
      if (cleanup) {
        cleanup();
        elementCleanupCallbacks.delete(containerKey);
      }
    });

    // Create the element ref - a callable function that holds the container
    const ref = ((lifecycleCallback: LifecycleCallback<TElement>): TElement => {
      // Store lifecycle callback (cast to base type for storage)
      const containerKey = container as object;
      elementLifecycleCallbacks.set(containerKey, lifecycleCallback as LifecycleCallback<object>);

      // If already connected, call immediately
      if (renderer.isConnected(container)) {
        const cleanup = lifecycleCallback(container);
        if (cleanup) {
          elementCleanupCallbacks.set(containerKey, cleanup);
        }
      }

      return container;
    }) as ElementRef<TElement>;

    // Attach container to ref so it can be extracted
    ref.element = container;

    return ref;
  }

  return {
    name: 'elMap',
    method: elMap,
  };
}
