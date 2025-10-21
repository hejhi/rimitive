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
import type { Reactive, RefSpec, ReactiveElement, FragmentRef, LifecycleCallback, ElementRef } from './types';
import { isRefSpec, STATUS_FRAGMENT } from './types';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';
import { disposeScope, trackInSpecificScope } from './helpers/scope';
import type { ViewContext } from './context';

interface MatchState<TElement = ReactiveElement> extends FragmentRef<TElement> {
  // Parent element (stored locally for reconciliation since attach only receives element)
  parentElement?: TElement;
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
    ) => RefSpec<TElement>
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
  ): RefSpec<TElement> {
    const lifecycleCallbacks: LifecycleCallback<TElement>[] = [];

    const ref = ((
      lifecycleCallback: LifecycleCallback<TElement>
    ): RefSpec<TElement> => {
      lifecycleCallbacks.push(lifecycleCallback);
      return ref; // Chainable
    }) as RefSpec<TElement>;

    ref.create = (): FragmentRef<TElement> => {
      const state: MatchState<TElement> = {
        status: STATUS_FRAGMENT,
        ref: undefined,
        prev: undefined,
        next: undefined,
        currentChild: null,
        nextSibling: null,
        attach: (parent: TElement, nextSibling?: TElement | null): void => {
          // Store parent element and nextSibling boundary marker
          state.parentElement = parent;
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
              const nodeRef = elementRef.create();
              // Match children should be ElementRefs
              const childEl = (nodeRef as ElementRef<TElement>).element;
              // Insert before nextSibling to maintain stable position
              renderer.insertBefore(parent, childEl, state.nextSibling);
              state.currentChild = childEl;
            }
          });

          const parentScope = ctx.elementScopes.get(parent);
          if (parentScope) trackInSpecificScope(parentScope, { dispose });
        },
      };

      return state;
    };

    return ref;
  }

  return {
    name: 'match',
    method: match,
  };
}
