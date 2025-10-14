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
  ReactiveList,
  ReactiveElement,
} from './types';
import { reconcileList } from './helpers/reconcile';
import type { ViewContext } from './context';

/**
 * Options passed to elMap factory
 */
export type ElMapOpts = {
  ctx: ViewContext;
  signal: <T>(value: T) => Reactive<T>;
  effect: (fn: () => void | (() => void)) => () => void;
};

/**
 * Factory return type
 */
export type ElMapFactory = LatticeExtension<
  'elMap',
  <T>(
    itemsSignal: Reactive<T[]>,
    render: (itemSignal: Reactive<T>) => ReactiveElement,
    keyFn?: (item: T) => unknown
  ) => ReactiveList<T>
>;

/**
 * Item node metadata
 */
interface ItemNode<T> {
  key: unknown;
  element: ReactiveElement;
  itemData: T;
  itemSignal: Reactive<T> & ((value: T) => void); // Writable signal
}

/**
 * Create the elMap primitive factory
 */
export function createElMapFactory(opts: ElMapOpts): ElMapFactory {
  const { signal, effect } = opts;
  // ctx is passed through but not used directly here
  // It's used by el() when render function is called

  function elMap<T>(
    itemsSignal: Reactive<T[]>,
    render: (itemSignal: Reactive<T>) => ReactiveElement,
    keyFn: (item: T) => unknown = (item) => item
  ): ReactiveList<T> {
    // Create a container element that will hold the list
    const container = document.createElement('div') as ReactiveElement;
    container.style.display = 'contents'; // Don't affect layout

    // Track items by key
    const itemMap = new Map<any, ItemNode<T>>();
    let previousItems: T[] = [];

    // Create an effect that reconciles the list when items change
    // PATTERN: Effect automatically schedules via scheduler (like signals/effect.ts)
    const dispose = effect(() => {
      const currentItems = itemsSignal();

      reconcileList(
        container,
        previousItems,
        currentItems,
        itemMap as Map<unknown, {
          key: unknown;
          element: ReactiveElement;
          itemData: T;
          itemSignal?: ((value: T) => void) & (() => T);
        }>,
        (item: T) => {
          // PATTERN: Create signal once and reuse (like graph-edges.ts reuses deps)
          // This signal will be updated by reconcileList when item data changes
          const itemSignal = signal(item) as Reactive<T> & ((value: T) => void);

          // Render the item using the provided render function
          const element = render(itemSignal);

          // Store item metadata including signal for updates
          const key = keyFn(item);
          itemMap.set(key, {
            key,
            element,
            itemData: item,
            itemSignal
          });

          return element;
        },
        keyFn
      );

      // Update previous items for next reconciliation
      previousItems = currentItems;
    });

    // Attach dispose to container
    container.__disposeCallback = dispose;

    // Return the reactive list descriptor with container
    const reactiveList: ReactiveList<T> & { __container?: ReactiveElement } = {
      __type: 'reactive-list',
      signal: itemsSignal,
      render,
      keyFn,
      __container: container
    };

    return reactiveList as ReactiveList<T>;
  }

  return {
    name: 'elMap',
    method: elMap,
  };
}
