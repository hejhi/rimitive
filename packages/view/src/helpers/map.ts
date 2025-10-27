/**
 * User-space map() helper using stable signal pattern
 *
 * Key design principles:
 * - Render callback runs ONCE per key (no orphaned computeds)
 * - Each item gets a stable signal that map() updates
 * - Keys extracted from el() calls (no separate keyFn parameter)
 * - Efficient reconciliation with LIS algorithm
 */

import type { RefSpec, ElementRef, NodeRef, FragmentRef, Reactive } from '../types';
import { isElementRef } from '../types';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { LatticeContext } from '../context';
import type { CreateScopes } from './scope';
import { reconcileWithKeys, type ReconcileState } from './reconcile';
import { createFragment } from './fragment';

export interface MapHelperOpts<
  TElement extends RendererElement,
  TText extends TextNode
> {
  ctx: LatticeContext;
  signal: <T>(value: T) => Reactive<T> & ((value: T) => void);
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  withElementScope: <T>(element: object, fn: () => T) => T;
  renderer: Renderer<TElement, TText>;
  disposeScope: CreateScopes['disposeScope'];
}

/**
 * Create a map helper with injected dependencies
 *
 * This is a factory that returns the map() function with access to
 * renderer, ctx, and other utilities
 */
export function createMapHelper<
  TElement extends RendererElement,
  TText extends TextNode
>(opts: MapHelperOpts<TElement, TText>) {
  const { ctx, signal, scopedEffect, withElementScope, renderer, disposeScope } = opts;

  /**
   * User-space map() with stable signals
   *
   * Each item gets a stable signal that map() manages. Render callback
   * runs ONCE per key, preventing orphaned computeds.
   *
   * Usage:
   *   map(
   *     () => items(),
   *     (itemSignal) => Component(api, itemSignal, itemSignal().id)
   *   )
   */
  function map<T>(
    items: () => T[],
    render: (itemSignal: Reactive<T>) => RefSpec<TElement>
  ): FragmentRef<TElement> {
    return createFragment((parent: ElementRef<TElement>, nextSibling?: NodeRef<TElement> | null) => {
      // Store signals and RefSpecs per key (separate from reconciliation)
      type ItemEntry = {
        signal: Reactive<T> & ((value: T) => void);
        refSpec: RefSpec<TElement>;
      };
      const itemData = new Map<string, ItemEntry>();

      // Reconciliation state (expected by reconcileWithKeys)
      const state: ReconcileState<TElement> = {
        itemsByKey: new Map(),
        parentElement: parent.element,
        parentRef: parent,
        nextSibling: nextSibling || undefined,
      };

      // Pooled buffers for LIS calculation
      const oldIndicesBuf: number[] = [];
      const newPosBuf: number[] = [];
      const lisBuf: number[] = [];

      // Create effect within parent's scope - auto-tracked!
      const effectDispose = withElementScope(parent.element, () => {
        return scopedEffect(() => {
          const currentItems = items();
          const refSpecs: RefSpec<TElement>[] = [];

          // Build RefSpecs array
          // For NEW items: create signal and call render
          // For EXISTING items: update signal, reuse stored RefSpec
          for (const item of currentItems) {
            // Create temporary signal to get key from RefSpec
            const tempSignal = signal(item);
            const tempRefSpec = render(tempSignal);
            const key = tempRefSpec.key;

            if (!key) {
              throw new Error('map() requires RefSpec to have a key. Pass key to el() call.');
            }

            const keyStr = String(key);
            const existing = itemData.get(keyStr);

            if (existing) {
              // Existing item: update signal with new data, reuse RefSpec
              existing.signal(item);
              refSpecs.push(existing.refSpec);
            } else {
              // New item: store signal and RefSpec for future reuse
              itemData.set(keyStr, {
                signal: tempSignal,
                refSpec: tempRefSpec,
              });
              refSpecs.push(tempRefSpec);
            }
          }

          // Clear pooled buffers
          oldIndicesBuf.length = 0;
          newPosBuf.length = 0;
          lisBuf.length = 0;

          // Reconcile using keys from RefSpecs
          reconcileWithKeys(
            refSpecs,
            state,
            ctx,
            renderer,
            disposeScope,
            oldIndicesBuf,
            newPosBuf,
            lisBuf
          );
        });
      });

      // Return cleanup function
      return () => {
        // Dispose the effect
        effectDispose();

        // Clean up all tracked elements
        for (const [, node] of state.itemsByKey) {
          if (isElementRef(node)) {
            const scope = ctx.elementScopes.get(node.element);
            if (scope) {
              disposeScope(scope);
              ctx.elementScopes.delete(node.element);
            }
            renderer.removeChild(state.parentElement, node.element);
          }
        }
        state.itemsByKey.clear();
        itemData.clear();
      };
    });
  }

  return map;
}
