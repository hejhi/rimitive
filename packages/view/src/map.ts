/**
 * User-space map() helper using stable signal pattern
 */

import type { LatticeExtension, InstrumentationContext, ExtensionContext } from '@lattice/lattice';
import { create } from '@lattice/lattice';
import type { RefSpec, SealedSpec, FragmentRef, Reactive, ElementRef, LifecycleCallback } from './types';
import { STATUS_ELEMENT, STATUS_FRAGMENT, STATUS_REF_SPEC } from './types';
import type { Renderer, RendererConfig } from './renderer';
import type { CreateScopes } from './helpers/scope';
import { createReconciler, ReconcileNode } from './helpers/reconcile';
import { createNodeHelpers } from './helpers/node-helpers';
import { removeFromFragment } from './helpers/fragment-boundaries';

/**
 * Map factory type - curried for element builder pattern
 */
export type MapFactory<TBaseElement> = LatticeExtension<
  'map',
  {
    // Array
    <T, TEl>(
      items: T[],
      keyFn?: (item: T) => string | number
    ): (render: (itemSignal: Reactive<T>) => RefSpec<TEl> | SealedSpec<TEl>) => RefSpec<TBaseElement>;
    <T, TEl>(
      items: Reactive<T[]>,
      keyFn?: (item: T) => string | number
    ): (render: (itemSignal: Reactive<T>) => RefSpec<TEl> | SealedSpec<TEl>) => RefSpec<TBaseElement>;
    // Plain function that returns array
    <T, TEl>(
      items: () => T[],
      keyFn?: (item: T) => string | number
    ): (render: (itemSignal: Reactive<T>) => RefSpec<TEl> | SealedSpec<TEl>) => RefSpec<TBaseElement>;
  }
>;

export interface MapOpts<TConfig extends RendererConfig> {
  signal: <T>(value: T) => Reactive<T> & ((value: T) => void);
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TConfig>;
  disposeScope: CreateScopes['disposeScope'];
  getElementScope: CreateScopes['getElementScope'];
}

export interface MapProps<TBaseElement> {
  instrument?: (
    method: MapFactory<TBaseElement>['method'],
    instrumentation: InstrumentationContext,
    context: ExtensionContext
  ) => MapFactory<TBaseElement>['method'];
}

type RecNode<T, TElement> = ElementRef<TElement> & ReconcileNode<(value: T) => void>;

/**
 * Map primitive - instantiatable extension using the create pattern
 * Similar to Signal() in signals preset
 */
export const Map = create(
  <TConfig extends RendererConfig>({
    signal,
    scopedEffect,
    renderer,
    disposeScope,
    getElementScope,
  }: MapOpts<TConfig>) =>
    (props?: MapProps<TConfig['baseElement']>) => {
      type TBaseElement = TConfig['baseElement'];
      type TFragRef = FragmentRef<TBaseElement>;
      type TRefSpec = RefSpec<TBaseElement>;
      type TSealedSpec = SealedSpec<TBaseElement>;
      type TSpec = TRefSpec | TSealedSpec;

      const { instrument } = props ?? {};
      const { insertNodeBefore, removeNode } = createNodeHelpers({
        renderer,
        disposeScope,
        getElementScope,
      });

      /**
       * Helper to create a RefSpec for fragments with lifecycle callback chaining
       */
      const createRefSpec = (
        createFragmentRef: (callbacks: LifecycleCallback<TBaseElement>[], api?: unknown) => TFragRef
      ): TRefSpec => {
        const lifecycleCallbacks: LifecycleCallback<TBaseElement>[] = [];

        const refSpec: TRefSpec = (
          ...callbacks: LifecycleCallback<TBaseElement>[]
        ) => {
          lifecycleCallbacks.push(...callbacks);
          return refSpec;
        };

        refSpec.status = STATUS_REF_SPEC;
        refSpec.create = <TExt>(
          api?: unknown,
          extensions?: TExt
        ) => {
          const fragRef = createFragmentRef(lifecycleCallbacks, api);
          // If no extensions, return the ref directly to preserve mutability
          if (!extensions || Object.keys(extensions).length === 0) return fragRef;

          return {
            ...fragRef,
            ...extensions,
          };
        };

        return refSpec;
      };

      function map<T>(
        items: T[] | (() => T[]) | Reactive<T[]>,
        keyFn?: (item: T) => string | number
      ): (render: (itemSignal: Reactive<T>) => TSpec) => TRefSpec {
        type TRecNode = RecNode<T, TBaseElement>;

        return (render: (itemSignal: Reactive<T>) => TSpec) =>
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
                const parentElement = parent.element;

                // nextSibling from fragment can be NodeRef (element/comment/fragment), but map only uses elements
                // Filter to element refs only for reconciliation
                const nextElementSibling =
                  nextSibling && nextSibling.status === STATUS_ELEMENT
                    ? (nextSibling as TRecNode)
                    : undefined;

                // Create reconciler with internal state management and hooks
                const { reconcile, dispose } = createReconciler<
                  T,
                  TBaseElement,
                  TRecNode
                >({
                  parentElement,
                  parentRef: parent,
                  nextSibling: nextElementSibling,

                  onCreate: (item) => {
                    // Use nested effect to isolate render callback and lifecycle from tracking
                    // This prevents signals read in render/lifecycle from being tracked by map's effect
                    let elRef: TRecNode;

                    const isolate = scopedEffect(() => {
                      const itemSignal = signal(item);

                      // Render the item - this creates an element with its own scope
                      // Pass api for SealedSpec components created with create()
                      elRef = render(itemSignal).create(api) as TRecNode;

                      // Insert into DOM
                      insertNodeBefore(
                        api,
                        parentElement,
                        elRef,
                        undefined,
                        nextSibling
                      );

                      // Update fragment boundaries (items are appended at end before nextSibling)
                      if (!fragment.firstChild) {
                        // First item in fragment
                        fragment.firstChild = elRef;
                        fragment.lastChild = elRef;
                      } else {
                        // Appending at end - update lastChild
                        fragment.lastChild = elRef;
                      }

                      elRef.data = itemSignal;
                    });

                    isolate(); // Dispose immediately after it runs

                    // Attach the signal to the node ref for updates
                    return elRef!;
                  },

                  // onUpdate: called when existing item's data should be updated
                  onUpdate(item, node) {
                    node.data(item);
                  },

                  // onMove: called when item needs repositioning
                  onMove(node, nextSiblingNode) {
                    if (node.status !== STATUS_ELEMENT) return;
                    insertNodeBefore(
                      api,
                      parentElement,
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

                    removeNode(parentElement, node);
                  },
                });

                // Execute lifecycle callbacks within parent's scope
                const lifecycleCleanups: (() => void)[] = [];
                for (const callback of lifecycleCallbacks) {
                  const cleanup = callback(parentElement);
                  if (cleanup) lifecycleCleanups.push(cleanup);
                }

                // Create effect within parent's scope - auto-tracked!
                const effectDispose = scopedEffect(() => {
                  // Get items - handle both array and function
                  const itemsArray =
                    typeof items === 'function' ? items() : items;

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
        method: map,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
