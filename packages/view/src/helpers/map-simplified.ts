/**
 * DEMO: How map.ts could be simplified with auto-tracking effects
 *
 * This shows the same map() implementation but using scopedEffect instead
 * of manual effect + trackInSpecificScope calls.
 */

import type { RefSpec, FragmentRef, ElementRef, NodeRef } from '../types';
import { STATUS_FRAGMENT, isElementRef } from '../types';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { LatticeContext } from '../context';
import type { CreateScopes } from './scope';
import { reconcileWithKeys, type ReconcileState } from './reconcile';
import { withElementScope } from './scoped-effect';

export interface MapHelperOpts<
  TElement extends RendererElement,
  TText extends TextNode
> {
  ctx: LatticeContext;
  scopedEffect: (fn: () => void | (() => void)) => () => void; // Auto-tracking effect
  renderer: Renderer<TElement, TText>;
  disposeScope: CreateScopes['disposeScope'];
}

/**
 * Create a map helper with auto-tracking effects
 */
export function createMapHelper<
  TElement extends RendererElement,
  TText extends TextNode
>(opts: MapHelperOpts<TElement, TText>) {
  const { ctx, scopedEffect, renderer, disposeScope } = opts;

  function map(
    render: () => RefSpec<TElement> | RefSpec<TElement>[]
  ): RefSpec<TElement> {
    const state: ReconcileState<TElement> & {
      itemsByKey: Map<string, unknown>;
      parentElement: TElement;
      nextSibling?: NodeRef<TElement>;
    } = {
      itemsByKey: new Map(),
      parentElement: null as unknown as TElement,
      nextSibling: undefined,
    };

    const oldIndicesBuf: number[] = [];
    const newPosBuf: number[] = [];
    const lisBuf: number[] = [];

    const refSpec: RefSpec<TElement> = () => refSpec;

    refSpec.create = <TExt>(extensions?: TExt): FragmentRef<TElement> & TExt & { dispose?: () => void } => {
      const fragRef: FragmentRef<TElement> & { dispose?: () => void } = {
        status: STATUS_FRAGMENT,
        element: null,
        prev: undefined,
        next: undefined,
        firstChild: undefined,
        lastChild: undefined,
        dispose: undefined,
        ...extensions,
        attach: (parent: ElementRef<TElement>, nextSibling?): void => {
          state.parentElement = parent.element;
          state.parentRef = parent;
          state.nextSibling = nextSibling || fragRef.next;

          // BEFORE: Manual tracking
          // const dispose = effect(() => { /* reconcile */ });
          // const parentScope = ctx.elementScopes.get(parent.element);
          // if (parentScope) trackInSpecificScope(parentScope, { dispose });

          // AFTER: Auto-tracking via context
          const dispose = withElementScope(ctx, parent.element, () => {
            return scopedEffect(() => {
              const result = render();
              const refSpecs = Array.isArray(result) ? result : [result];

              oldIndicesBuf.length = 0;
              newPosBuf.length = 0;
              lisBuf.length = 0;

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

          // Rest of disposal logic...
          fragRef.dispose = () => {
            dispose();
            for (const [, node] of state.itemsByKey as Map<string, any>) {
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
