/**
 * User-space map() helper using stable signal pattern
 */

import type { LatticeExtension, InstrumentationContext, ExtensionContext } from '@lattice/lattice';
import { create } from '@lattice/lattice';
import type { RefSpec, SealedSpec, FragmentRef, Reactive, ElementRef } from './types';
import { STATUS_ELEMENT } from './types';
import type { Renderer, RendererConfig } from './renderer';
import type { CreateScopes } from './helpers/scope';
import { createReconciler, ReconcileNode } from './helpers/reconcile';
import { createFragmentHelpers } from './helpers/fragment';

const { createFragment, resolveNextRef } = createFragmentHelpers();

/**
 * Map factory type - curried for element builder pattern
 */
export type MapFactory<TConfig extends RendererConfig> = LatticeExtension<
  'map',
  {
    // Array
    <T, TEl>(
      items: T[],
      keyFn?: (item: T) => string | number
    ): (render: (itemSignal: Reactive<T>) => RefSpec<TEl> | SealedSpec<TEl>) => FragmentRef<TConfig['baseElement']>;
    <T, TEl>(
      items: Reactive<T[]>,
      keyFn?: (item: T) => string | number
    ): (render: (itemSignal: Reactive<T>) => RefSpec<TEl> | SealedSpec<TEl>) => FragmentRef<TConfig['baseElement']>;
    // Plain function that returns array
    <T, TEl>(
      items: () => T[],
      keyFn?: (item: T) => string | number
    ): (render: (itemSignal: Reactive<T>) => RefSpec<TEl> | SealedSpec<TEl>) => FragmentRef<TConfig['baseElement']>;
  }
>;

export interface MapHelperOpts<TConfig extends RendererConfig> {
  signal: <T>(value: T) => Reactive<T> & ((value: T) => void);
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TConfig>;
  disposeScope: CreateScopes['disposeScope'];
  getElementScope: CreateScopes['getElementScope'];
}

export interface MapProps<
  TConfig extends RendererConfig,
> {
  instrument?: (
    method: MapFactory<TConfig>['method'],
    instrumentation: InstrumentationContext,
    context: ExtensionContext
  ) => MapFactory<TConfig>['method'];
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
  }: MapHelperOpts<TConfig>) =>
    (props?: MapProps<TConfig>) => {
      type TBaseElement = TConfig['baseElement'];
      type TFragRef = FragmentRef<TBaseElement>;
      type TRefSpec = RefSpec<TBaseElement>;
      type TSealedSpec = SealedSpec<TBaseElement>;
      type TSpec = TRefSpec | TSealedSpec;

      const { instrument } = props ?? {};

      function map<T>(
        items: T[] | (() => T[]) | Reactive<T[]>,
        keyFn?: (item: T) => string | number
      ): (render: (itemSignal: Reactive<T>) => TSpec) => TFragRef {
        type TRecNode = RecNode<T, TBaseElement>;

        return (render: (itemSignal: Reactive<T>) => TSpec) =>
          createFragment((parent, nextSibling, api) => {
            const parentElement = parent.element;
            const nextSib = nextSibling as TRecNode | null | undefined;

            // Create reconciler with internal state management and hooks
            const { reconcile, dispose } = createReconciler<
              T,
              TBaseElement,
              TRecNode
            >({
              parentElement,
              parentRef: parent,
              nextSibling: nextSib ?? undefined,

              onCreate: (item) => {
                // Use nested effect to isolate render callback and lifecycle from tracking
                // This prevents signals read in render/lifecycle from being tracked by map's effect
                let elRef: TRecNode;

                const isolate = scopedEffect(() => {
                  const itemSignal = signal(item);

                  // Render the item - this creates an element with its own scope
                  // Pass api for SealedSpec components created with create()
                  elRef = render(itemSignal).create(
                    api
                  ) as TRecNode;

                  renderer.insertBefore(
                    parentElement,
                    elRef.element,
                    resolveNextRef(nextSibling)?.element ?? null
                  );

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

                let nextEl: TBaseElement | null = null;

                if (
                  nextSiblingNode &&
                  nextSiblingNode.status === STATUS_ELEMENT
                ) {
                  nextEl = nextSiblingNode.element;
                } else if (!nextSiblingNode) {
                  nextEl = resolveNextRef(nextSibling)?.element ?? null;
                }

                renderer.insertBefore(parentElement, node.element, nextEl);
              },

              // onRemove: called when item is being removed
              onRemove(node) {
                // Remove from DOM and clean up element scope
                if (node.status !== STATUS_ELEMENT) return;

                const scope = getElementScope(node.element);
                if (scope) disposeScope(scope);

                renderer.removeChild(parentElement, node.element);
              },
            });

            // Create effect within parent's scope - auto-tracked!
            const effectDispose = scopedEffect(() => {
              // Get items - handle both array and function
              const itemsArray = typeof items === 'function' ? items() : items;

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
            };
          });
      }

      const extension: MapFactory<TConfig> = {
        name: 'map',
        method: map,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
