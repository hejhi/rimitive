/**
 * User-space map() helper using closure pattern
 *
 * This demonstrates the extensibility pattern from the proposal:
 * - Closure state for reconciliation
 * - Returns FragmentFactory (no attach method needed)
 * - Keys come from el() rather than keyFn parameter
 * - Unified reconciliation for keyed and non-keyed arrays
 */

import type { RefSpec, ElementRef, NodeRef, FragmentRef } from '../types';
import { isElementRef } from '../types';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { LatticeContext } from '../context';
import type { CreateScopes } from './scope';
import { reconcileWithKeys, type ReconcileState, type ReconcileNode } from './reconcile';
import { createFragment } from './fragment';

export interface MapHelperOpts<
  TElement extends RendererElement,
  TText extends TextNode
> {
  ctx: LatticeContext;
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
  const { ctx, scopedEffect, withElementScope, renderer, disposeScope } = opts;

  /**
   * User-space map() using closure pattern
   *
   * Takes a render function that returns RefSpec(s) with keys
   * Keys come from el() calls, not from a keyFn parameter
   *
   * Usage:
   *   map(() => items().map(item => el(['li', item.name], item.id)))
   *   map(() => [cases[mode()]()])
   */
  function map(
    render: () => RefSpec<TElement> | RefSpec<TElement>[]
  ): FragmentRef<TElement> {
    // TODO: pass in node to callback too?
    return createFragment((parent: ElementRef<TElement>, nextSibling?: NodeRef<TElement> | null) => {
      // Closure state - persists across effect re-runs
      const state: ReconcileState<TElement> & {
        itemsByKey: Map<string, unknown>;
        parentElement: TElement;
        nextSibling?: NodeRef<TElement>;
      } = {
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
          // Call render - it reads whatever signals it needs
          const result = render();
          const refSpecs = Array.isArray(result) ? result : [result];

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
        for (const [, node] of state.itemsByKey as Map<string, ReconcileNode<TElement>>) {
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
      };
    });
  }

  return map;
}
