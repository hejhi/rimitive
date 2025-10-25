/**
 * User-space map() helper using closure pattern
 *
 * This demonstrates the extensibility pattern from the proposal:
 * - Closure state for reconciliation
 * - Returns RefSpec (internally uses fragment)
 * - Keys come from el() rather than keyFn parameter
 * - Unified reconciliation for keyed and non-keyed arrays
 */

import type { Reactive, RefSpec, FragmentRef, ElementRef } from '../types';
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
  effect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
  disposeScope: CreateScopes['disposeScope'];
  trackInSpecificScope: CreateScopes['trackInSpecificScope'];
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
  const { ctx, effect, renderer, disposeScope } = opts;

  /**
   * User-space map() using closure pattern
   *
   * Takes ANY reactive value and a render function
   * Keys come from el() calls, not from a keyFn parameter
   *
   * Usage:
   *   map(items, items => items.map(item => el(['li', item.name], item.id)))
   *   map(mode, m => [cases[m]()])
   */
  function map<T>(
    signal: Reactive<T>,
    render: (value: T) => RefSpec<TElement> | RefSpec<TElement>[]
  ): RefSpec<TElement> {
    // Closure state - persists across effect re-runs
    const state: ReconcileState<TElement> & {
      itemsByKey: Map<string, any>;
      parentElement: TElement;
      nextSibling?: any;
    } = {
      itemsByKey: new Map(),
      parentElement: null as any, // Set in attach()
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
          state.nextSibling = nextSibling || fragRef.next;

          // Create effect that reconciles when value changes
          const dispose = effect(() => {
            const value = signal();

            // Call render and normalize to array
            const result = render(value);
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

            // Return cleanup that removes all children when effect disposed
            return () => {
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

          // Store dispose on fragment for direct cleanup
          fragRef.dispose = dispose;
        },
      };

      return fragRef as FragmentRef<TElement> & TExt;
    };

    return refSpec;
  }

  return map;
}
