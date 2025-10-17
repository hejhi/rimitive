/**
 * Conditional rendering primitive
 *
 * match() creates a reactive conditional that swaps elements when the reactive
 * value changes. Unlike map which handles lists, match handles single element
 * conditional rendering.
 *
 * Usage:
 *   match(stateSignal, (state) => {
 *     if (state === 'loading') return el(['div', 'Loading...']);
 *     if (state === 'error') return el(['div', 'Error!']);
 *     return el(['div', 'Success']);
 *   })
 */

import type { LatticeExtension } from '@lattice/lattice';
import type {
  Reactive,
  RefSpec,
  Fragment,
  ReactiveElement,
} from './types';
import { isRefSpec } from './types';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';
import { disposeScope, trackInSpecificScope } from './helpers/scope';
import type { ViewContext } from './context';

interface MatchState<TElement = ReactiveElement> {
  element: TElement | null;
  currentChild: TElement | null;
  nextSibling: TElement | null;
}

/**
 * Options passed to match factory
 */
export type MatchOpts<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode> = {
  ctx: ViewContext;
  effect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
};

/**
 * Factory return type
 */
export type MatchFactory<TElement extends RendererElement = RendererElement> =
  LatticeExtension<
    'match',
    <T>(
      reactive: Reactive<T>,
      render: (value: T) => RefSpec<TElement> | null | false
    ) => Fragment<TElement>
  >;

/**
 * Create the match primitive factory
 */
export function createMatchFactory<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode>(
  opts: MatchOpts<TElement, TText>
): MatchFactory<TElement> {
  const { ctx, effect, renderer } = opts;

  function match<T>(
    reactive: Reactive<T>,
    render: (value: T) => RefSpec<TElement> | null | false
  ): Fragment<TElement> {
    const state: MatchState<TElement> = {
      element: null,
      currentChild: null,
      nextSibling: null,
    };

    return {
      attach: (parent: TElement, nextSibling?: TElement | null): void => {
        // Store parent in fragment state
        state.element = parent;
        state.nextSibling = nextSibling ?? null;

        // Create effect that swaps elements when reactive value changes
        const dispose = effect(() => {
          const value = reactive();
          const elementRef = render(value);

          // Remove old child if exists
          if (state.currentChild) {
            const oldScope = ctx.elementScopes.get(state.currentChild);
            if (oldScope) {
              disposeScope(oldScope);
              ctx.elementScopes.delete(state.currentChild);
            }
            renderer.removeChild(parent, state.currentChild);
            state.currentChild = null;
          }

          // Create new child if not null/false
          if (elementRef && isRefSpec(elementRef)) {
            const newElement = elementRef.create();
            // Insert before nextSibling to maintain stable position
            renderer.insertBefore(parent, newElement, state.nextSibling);
            state.currentChild = newElement;
          }
        });

        const parentScope = ctx.elementScopes.get(parent);
        if (parentScope) trackInSpecificScope(parentScope, { dispose });
      }
    };
  }

  return {
    name: 'match',
    method: match,
  };
}
