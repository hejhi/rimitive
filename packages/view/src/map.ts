/**
 * User-space map() helper using stable signal pattern
 */

import type {
  ServiceDefinition,
  InstrumentationContext,
  ServiceContext,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import type {
  RefSpec,
  FragmentRef,
  Reactive,
  ElementRef,
  LifecycleCallback,
} from './types';
import { STATUS_ELEMENT, STATUS_FRAGMENT, STATUS_REF_SPEC } from './types';
import type { Adapter, AdapterConfig } from './adapter';
import type { CreateScopes } from './helpers/scope';
import { createReconciler, ReconcileNode } from './helpers/reconcile';
import { createNodeHelpers } from './helpers/node-helpers';
import { removeFromFragment } from './helpers/fragment-boundaries';

/**
 * Map factory type - curried for element builder pattern
 *
 * Items can be a static array or a reactive signal of array.
 * The render callback receives items directly (not wrapped in signals).
 * If items are signals themselves, updates push new values into them.
 * If items are plain values, components are recreated on update.
 */
export type MapFactory<TBaseElement> = ServiceDefinition<
  'map',
  {
    <T, TEl>(
      items: T[] | Reactive<T[]>,
      keyFn?: (item: T) => string | number
    ): (render: (item: T) => RefSpec<TEl>) => RefSpec<TBaseElement>;
  }
>;

export interface MapOpts<TConfig extends AdapterConfig> {
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  adapter: Adapter<TConfig>;
  disposeScope: CreateScopes['disposeScope'];
  getElementScope: CreateScopes['getElementScope'];
}

export interface MapProps<TBaseElement> {
  instrument?: (
    impl: MapFactory<TBaseElement>['impl'],
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => MapFactory<TBaseElement>['impl'];
}

type RecNode<T, TElement> = ElementRef<TElement> & ReconcileNode<T>;

/**
 * Shallow equality check for items
 * For primitives: strict equality
 * For objects: compare own enumerable properties (one level deep)
 */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a === null || b === null) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (
      (a as Record<string, unknown>)[key] !==
      (b as Record<string, unknown>)[key]
    )
      return false;
  }
  return true;
}

/**
 * Map primitive - instantiatable extension using the create pattern
 * Similar to Signal() in signals preset
 */
export const Map = defineService(
  <TConfig extends AdapterConfig>({
    scopedEffect,
    adapter,
    disposeScope,
    getElementScope,
  }: MapOpts<TConfig>) =>
    (props?: MapProps<TConfig['baseElement']>) => {
      type TBaseElement = TConfig['baseElement'];
      type TFragRef = FragmentRef<TBaseElement>;

      const { instrument } = props ?? {};
      const { insertNodeBefore, removeNode } = createNodeHelpers({
        adapter,
        disposeScope,
        getElementScope,
      });

      /**
       * Helper to create a RefSpec for fragments with lifecycle callback chaining
       */
      const createRefSpec = (
        createFragmentRef: (
          callbacks: LifecycleCallback<TBaseElement>[],
          api?: unknown
        ) => TFragRef
      ): RefSpec<TBaseElement> => {
        const lifecycleCallbacks: LifecycleCallback<TBaseElement>[] = [];

        const refSpec: RefSpec<TBaseElement> = (
          ...callbacks: LifecycleCallback<TBaseElement>[]
        ) => {
          lifecycleCallbacks.push(...callbacks);
          return refSpec;
        };

        refSpec.status = STATUS_REF_SPEC;
        refSpec.create = <TExt>(api?: unknown, extensions?: TExt) => {
          const fragRef = createFragmentRef(lifecycleCallbacks, api);
          // If no extensions, return the ref directly to preserve mutability
          if (!extensions || Object.keys(extensions).length === 0)
            return fragRef;

          return {
            ...fragRef,
            ...extensions,
          };
        };

        return refSpec;
      };

      function map<T, TEl>(
        items: T[] | Reactive<T[]>,
        keyFn?: (item: T) => string | number
      ): (render: (item: T) => RefSpec<TEl>) => RefSpec<TBaseElement> {
        type TRecNode = RecNode<T, TBaseElement>;

        return (render: (item: T) => RefSpec<TEl>) =>
          createRefSpec((lifecycleCallbacks, api) => {
            const fragment: FragmentRef<TBaseElement> = {
              status: STATUS_FRAGMENT,
              element: null,
              parent: null,
              prev: null,
              next: null,
              firstChild: null,
              lastChild: null,
              attach(parent, nextSibling) {
                // Don't capture parent.element - always dereference it at call time
                // This allows the parent element to be updated (e.g., after unwrapping fragment containers)
                // and have the reconciler pick up the new value

                // nextSibling from fragment can be NodeRef (element/comment/fragment), but map only uses elements
                // Filter to element refs only for reconciliation
                const nextElementSibling =
                  nextSibling && nextSibling.status === STATUS_ELEMENT
                    ? (nextSibling as TRecNode)
                    : undefined;

                /**
                 * Create a node for an item, optionally replacing an existing node
                 */
                const createItemNode = (
                  item: T,
                  replaceNode?: TRecNode
                ): TRecNode => {
                  let elRef: TRecNode;

                  const isolate = scopedEffect(() => {
                    // Render the item directly - no signal wrapping
                    elRef = render(item).create<TRecNode>(api);

                    if (replaceNode) {
                      // Replace: insert before old node, then remove old node
                      insertNodeBefore(
                        api,
                        parent.element,
                        elRef,
                        replaceNode,
                        nextSibling
                      );

                      // Update linked list - new node takes old node's position
                      elRef.prev = replaceNode.prev;
                      elRef.next = replaceNode.next;
                      if (replaceNode.prev) replaceNode.prev.next = elRef;
                      if (replaceNode.next) replaceNode.next.prev = elRef;

                      // Update fragment boundaries if replacing a boundary node
                      if (fragment.firstChild === replaceNode)
                        fragment.firstChild = elRef;
                      if (fragment.lastChild === replaceNode)
                        fragment.lastChild = elRef;

                      // Remove old node from DOM
                      removeNode(parent.element, replaceNode);
                    } else {
                      // Insert: append at boundary position
                      insertNodeBefore(
                        api,
                        parent.element,
                        elRef,
                        undefined,
                        nextSibling
                      );

                      // Update fragment boundaries and link items
                      if (!fragment.firstChild) {
                        fragment.firstChild = elRef;
                        fragment.lastChild = elRef;
                        elRef.prev = null;
                        elRef.next = null;
                      } else {
                        const prevLast = fragment.lastChild;
                        if (prevLast) {
                          prevLast.next = elRef;
                          elRef.prev = prevLast;
                        }
                        elRef.next = null;
                        fragment.lastChild = elRef;
                      }
                    }

                    // Store item for update detection
                    elRef.data = item;
                  });

                  isolate(); // Dispose immediately after it runs
                  return elRef!;
                };

                // Create reconciler with internal state management and hooks
                const { reconcile, dispose } = createReconciler<
                  T,
                  TBaseElement,
                  TRecNode
                >({
                  parentElement: parent.element,
                  parentRef: parent,
                  nextSibling: nextElementSibling,

                  onCreate: (item) => createItemNode(item),

                  // onUpdate: called when existing item's data should be updated
                  // Returns replacement node if item was recreated
                  onUpdate(item, node) {
                    const prevItem = node.data;

                    // If previous item is a function (signal), push new value into it
                    if (typeof prevItem === 'function') {
                      const newValue =
                        typeof item === 'function'
                          ? (item as () => unknown)()
                          : item;
                      (prevItem as (v: unknown) => void)(newValue);
                      node.data = item;
                      return; // Keep existing node
                    }

                    // Plain value - check if changed using shallow equality
                    if (shallowEqual(prevItem, item)) return; // No change

                    // Different value - recreate node
                    return createItemNode(item, node);
                  },

                  // onMove: called when item needs repositioning
                  onMove(node, nextSiblingNode) {
                    if (node.status !== STATUS_ELEMENT) return;
                    insertNodeBefore(
                      api,
                      parent.element,
                      node,
                      nextSiblingNode,
                      nextSibling
                    );
                  },

                  // onRemove: called when item is being removed
                  onRemove(node) {
                    if (node.status !== STATUS_ELEMENT) return;

                    // Update fragment boundaries if removing a boundary node
                    removeFromFragment(fragment, node);

                    removeNode(parent.element, node);
                  },
                });

                // Execute lifecycle callbacks within parent's scope
                const lifecycleCleanups: (() => void)[] = [];
                for (const callback of lifecycleCallbacks) {
                  const cleanup = callback(parent.element);
                  if (cleanup) lifecycleCleanups.push(cleanup);
                }

                // Create effect within parent's scope - auto-tracked!
                const effectDispose = scopedEffect(() => {
                  // Get items - handle both array and function
                  const itemsArray =
                    typeof items === 'function' ? items() : items;

                  // Validate: require key function when mapping over objects
                  if (!keyFn && itemsArray.length > 0) {
                    const firstItem = itemsArray[0];
                    // Check if it's an object (not null, not array, not primitive)
                    if (
                      firstItem !== null &&
                      typeof firstItem === 'object' &&
                      !Array.isArray(firstItem)
                    ) {
                      throw new Error(
                        'map() requires a key function when mapping over objects. ' +
                          'Without a key function, all objects become "[object Object]" which breaks reconciliation. ' +
                          'Example: map(items, (item) => item.id)((item) => ...)'
                      );
                    }
                  }

                  // Reconcile with just items and key function
                  reconcile(itemsArray, (item) =>
                    keyFn ? keyFn(item) : (item as string | number)
                  );
                });

                // Return cleanup function
                return () => {
                  // Dispose the effect
                  effectDispose();

                  // Dispose all remaining items via reconciler
                  // This calls onRemove hook for each tracked item
                  dispose();

                  // Run lifecycle cleanups
                  for (const cleanup of lifecycleCleanups) cleanup();
                };
              },
            };
            return fragment;
          });
      }

      const extension: MapFactory<TBaseElement> = {
        name: 'map',
        impl: map,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
