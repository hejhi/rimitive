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
import type { Reactive, ElementRef, MatchFragment, MatchFragmentState } from './types';
import { FRAGMENT, isElementRef } from './types';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';
import { disposeScope, trackInSpecificScope } from './helpers/scope';
import type { ViewContext } from './context';

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
export type MatchFactory<TElement extends RendererElement = RendererElement> = LatticeExtension<
  'match',
  <T>(
    reactive: Reactive<T>,
    render: (value: T) => ElementRef<TElement> | null | false
  ) => MatchFragment<TElement>
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
    render: (value: T) => ElementRef<TElement> | null | false
  ): MatchFragment<TElement> {
    const state: MatchFragmentState<TElement> = {
      refType: FRAGMENT,
      element: null,
      currentChild: null,
      nextSibling: null,
    };

    const matchRef = ((parent: TElement): void => {
      // Store parent in fragment state
      state.element = parent;

      // Capture nextSibling at attachment time (marks our territory boundary)
      // This stays stable even when we hide/show our content
      state.nextSibling = null; // Will be set to next element if needed

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
        if (elementRef && isElementRef(elementRef)) {
          const newElement = elementRef.create();
          // Insert before nextSibling to maintain stable position
          renderer.insertBefore(parent, newElement, state.nextSibling);
          state.currentChild = newElement;
        }
      });

      // Track dispose in parent's scope
      const parentScope = ctx.elementScopes.get(parent);
      if (parentScope) trackInSpecificScope(parentScope, { dispose });
    }) as MatchFragment<TElement>;

    // Attach refType to fragment (type discrimination)
    matchRef.refType = FRAGMENT;

    return matchRef;
  }

  return {
    name: 'match',
    method: match as MatchFactory<TElement>['method'],
  };
}
