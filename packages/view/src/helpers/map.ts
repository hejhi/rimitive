/**
 * User-space map() helper using closure pattern
 *
 * This demonstrates the extensibility pattern from the proposal:
 * - Closure state for reconciliation
 * - Returns RefSpec (internally uses fragment)
 * - Keys come from el() rather than keyFn parameter
 * - Unified reconciliation for keyed and non-keyed arrays
 */

import type { RefSpec, FragmentRef, ElementRef, NodeRef } from '../types';
import { STATUS_FRAGMENT, isElementRef } from '../types';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { LatticeContext } from '../context';
import type { CreateScopes } from './scope';
import { reconcileWithKeys, type ReconcileState, type ReconcileNode } from './reconcile';

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
  ): RefSpec<TElement> {
    // Closure state - persists across effect re-runs
    const state: ReconcileState<TElement> & {
      itemsByKey: Map<string, unknown>;
      parentElement: TElement;
      nextSibling?: NodeRef<TElement>;
    } = {
      itemsByKey: new Map(),
      parentElement: null as unknown as TElement, // Set in attach()
      nextSibling: undefined,
    };

    // Pooled buffers for LIS calculation
    const oldIndicesBuf: number[] = [];
    const newPosBuf: number[] = [];
    const lisBuf: number[] = [];

    const refSpec: RefSpec<TElement> = () => refSpec; // Chainable lifecycle

    refSpec.create = <TExt>(extensions?: TExt): FragmentRef<TElement> & TExt & { dispose?: () => void } => {
      const fragRef: FragmentRef<TElement> & { dispose?: () => void } = {
        status: STATUS_FRAGMENT,
        element: null,
        prev: undefined,
        next: undefined,
        firstChild: undefined,
        lastChild: undefined,
        dispose: undefined, // Set in attach
        ...extensions,
        attach: (parent: ElementRef<TElement>, nextSibling?): void => {
          // Store parent and boundary for reconciliation
          state.parentElement = parent.element;
          state.parentRef = parent;
          state.nextSibling = nextSibling || fragRef.next;

          // Create effect within parent's scope - auto-tracked!
          const dispose = withElementScope(parent.element, () => {
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

              // NOTE: No cleanup return here!
              // itemsByKey must persist across reconciliations for element reuse
              // Cleanup happens when fragment itself is disposed
            });
          });

          // Store dispose function that cleans up both effect and elements
          fragRef.dispose = () => {
            // Dispose the effect
            dispose();

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
        },
      };

      return fragRef as FragmentRef<TElement> & TExt;
    };

    return refSpec;
  }

  return map;
}
