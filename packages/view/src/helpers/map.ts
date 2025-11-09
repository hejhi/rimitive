/**
 * User-space map() helper using stable signal pattern
 *
 * Key design principles:
 * - Render callback runs ONCE per key (no orphaned computeds)
 * - Each item gets a stable signal that map() updates
 * - Keys extracted from el() calls (no separate keyFn parameter)
 * - Efficient reconciliation with LIS algorithm
 */

import type { LatticeExtension, InstrumentationContext, ExtensionContext } from '@lattice/lattice';
import { create } from '@lattice/lattice';
import type { RefSpec, SealedSpec, FragmentRef, Reactive, ElementRef } from '../types';
import { isElementRef } from '../types';
import { resolveNextRef } from './fragment';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { LatticeContext } from '../context';
import type { CreateScopes } from './scope';
import { createReconciler, ReconcileNode } from './reconcile';
import { createFragment } from './fragment';
import type { GlobalContext } from '@lattice/signals/context';
import { createUntracked } from '@lattice/signals/untrack';

/**
 * Map factory type - curried for element builder pattern
 */
export type MapFactory<TElement extends RendererElement> = LatticeExtension<
  'map',
  <T>(
    items: () => T[],
    keyFn?: (item: T) => string | number
  ) => (render: (itemSignal: Reactive<T>) => RefSpec<TElement> | SealedSpec<TElement>) => FragmentRef<TElement>
>;

export interface MapHelperOpts<
  TElement extends RendererElement,
  TText extends TextNode
> {
  ctx: LatticeContext<TElement>;
  signalCtx: GlobalContext;
  signal: <T>(value: T) => Reactive<T> & ((value: T) => void);
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
  disposeScope: CreateScopes['disposeScope'];
}

export interface MapProps<
  TElement extends RendererElement,
> {
  instrument?: (
    method: MapFactory<TElement>['method'],
    instrumentation: InstrumentationContext,
    context: ExtensionContext
  ) => MapFactory<TElement>['method'];
}

type RecNode<T, TElement> = ElementRef<TElement> & ReconcileNode<(value: T) => void>;

/**
 * Map primitive - instantiatable extension using the create pattern
 * Similar to Signal() in signals preset
 */
export const Map = create(
  <
    TElement extends RendererElement = HTMLElement,
    TText extends TextNode = Text,
  >({
    ctx,
    signalCtx,
    signal,
    scopedEffect,
    renderer,
    disposeScope,
  }: MapHelperOpts<TElement, TText>) =>
    (props?: MapProps<TElement>) => {
      const { instrument } = props ?? {}
      const untrack = createUntracked({ ctx: signalCtx });

      function map<T>(
        items: () => T[],
        keyFn?: (item: T) => string | number
      ): (
        render: (
          itemSignal: Reactive<T>
        ) => RefSpec<TElement> | SealedSpec<TElement>
      ) => FragmentRef<TElement> {
        return (
          render: (
            itemSignal: Reactive<T>
          ) => RefSpec<TElement> | SealedSpec<TElement>
        ) =>
          createFragment((parent, nextSibling, api) => {
            const parentEl = parent.element;
            const nextSib = nextSibling as
              | RecNode<T, TElement>
              | null
              | undefined;

            // Create reconciler with internal state management and hooks
            const { reconcile, dispose } = createReconciler<
              T,
              TElement,
              RecNode<T, TElement>
            >({
              parentElement: parentEl,
              parentRef: parent,
              nextSibling: nextSib ?? undefined,

              onCreate: untrack(() => (item) => {
                const itemSignal = signal(item);

                // Render the item - this creates an element with its own scope
                // Pass api for SealedSpec components created with create()
                const elRef = render(itemSignal).create(api) as RecNode<
                  T,
                  TElement
                >;

                renderer.insertBefore(
                  parentEl,
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
                if (!isElementRef(node)) return;

                let nextEl: TElement | null = null;

                if (nextSiblingNode && isElementRef(nextSiblingNode)) {
                  nextEl = nextSiblingNode.element;
                } else if (!nextSiblingNode) {
                  nextEl = resolveNextRef(nextSibling)?.element ?? null;
                }

                renderer.insertBefore(parentEl, node.element, nextEl);
              },

              // onRemove: called when item is being removed
              onRemove(node) {
                // Remove from DOM and clean up element scope
                if (!isElementRef(node)) return;

                const scope = ctx.elementScopes.get(node.element);
                if (scope) disposeScope(scope);

                renderer.removeChild(parentEl, node.element);
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

      const extension: MapFactory<TElement> = {
        name: 'map',
        method: map,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
