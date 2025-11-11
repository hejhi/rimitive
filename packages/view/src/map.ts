/**
 * User-space map() helper using stable signal pattern
 */

import type { LatticeExtension, InstrumentationContext, ExtensionContext } from '@lattice/lattice';
import { create } from '@lattice/lattice';
import type { RefSpec, SealedSpec, FragmentRef, Reactive, ElementRef } from './types';
import { STATUS_ELEMENT } from './types';
import type { Renderer, RendererConfig } from './renderer';
import type { ViewContext } from './context';
import type { CreateScopes } from './helpers/scope';
import { createReconciler, ReconcileNode } from './helpers/reconcile';
import { createFragment, resolveNextRef } from './helpers/fragment';
import type { GlobalContext } from '@lattice/signals/context';
import { createUntracked } from '@lattice/signals/untrack';

/**
 * Map factory type - curried for element builder pattern
 */
export type MapFactory<TConfig extends RendererConfig> = LatticeExtension<
  'map',
  <T>(
    items: () => T[],
    keyFn?: (item: T) => string | number
  ) => (render: (itemSignal: Reactive<T>) => RefSpec<TConfig['baseElement']> | SealedSpec<TConfig['baseElement']>) => FragmentRef<TConfig['baseElement']>
>;

export interface MapHelperOpts<
  TConfig extends RendererConfig,
> {
  ctx: ViewContext<TConfig['baseElement']>;
  signalCtx: GlobalContext;
  signal: <T>(value: T) => Reactive<T> & ((value: T) => void);
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TConfig>;
  disposeScope: CreateScopes['disposeScope'];
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
  <
    TConfig extends RendererConfig,
  >({
    ctx,
    signalCtx,
    signal,
    scopedEffect,
    renderer,
    disposeScope,
  }: MapHelperOpts<TConfig>) =>
    (props?: MapProps<TConfig>) => {
      type TBaseElement = TConfig['baseElement'];
      type TFragRef = FragmentRef<TBaseElement>;
      type TRefSpec = RefSpec<TBaseElement>;
      type TSealedSpec = SealedSpec<TBaseElement>;
      type TSpec = TRefSpec | TSealedSpec;

      const { instrument } = props ?? {}
      const untrack = createUntracked({ ctx: signalCtx });

      function map<T>(
        items: () => T[],
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

              onCreate: untrack(() => (item) => {
                const itemSignal = signal(item);

                // Render the item - this creates an element with its own scope
                // Pass api for SealedSpec components created with create()
                const elRef = render(itemSignal).create(api) as TRecNode;

                renderer.insertBefore(
                  parentElement,
                  elRef.element,
                  resolveNextRef(nextSibling)?.element ?? null
                );

                elRef.data = itemSignal;

                // Attach the signal to the node ref for updates
                return elRef;
              }),

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

                const scope = ctx.elementScopes.get(node.element);
                if (scope) disposeScope(scope);

                renderer.removeChild(parentElement, node.element);
              },
            });

            // Create effect within parent's scope - auto-tracked!
            const effectDispose = scopedEffect(() => {
              // Reconcile with just items and key function
              reconcile(items(), (item) =>
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
