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
import type { Reactive, RefSpec, ReactiveElement, FragmentRef, LifecycleCallback, NodeRef, ElementRef } from './types';
import { isRefSpec, isElementRef, STATUS_FRAGMENT, resolveNextElement } from './types';
import type { Renderer, Element as RendererElement, TextNode } from './renderer';
import type { LatticeContext } from './context';
import { CreateScopes } from './helpers/scope';

interface MatchFragRef<TElement = ReactiveElement> extends FragmentRef<TElement> {
  // Parent element (stored locally for reconciliation since attach only receives element)
  element?: TElement;
  // Current child NodeRef (prevents memory leaks by retaining full reference)
  firstChild?: ElementRef<TElement>;
  lastChild?: ElementRef<TElement>; // Same as firstChild for single-child fragments
}

/**
 * Options passed to match factory
 */
export type MatchOpts<TElement extends RendererElement = RendererElement, TText extends TextNode = TextNode> = {
  ctx: LatticeContext;
  effect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
  disposeScope: CreateScopes['disposeScope'];
  trackInSpecificScope: CreateScopes['trackInSpecificScope']
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
  const { ctx, effect, renderer, disposeScope, trackInSpecificScope } = opts;

  function match<T>(
    reactive: Reactive<T>,
    render: (value: T) => RefSpec<TElement> | null | false
  ): RefSpec<TElement> {
    const lifecycleCallbacks: LifecycleCallback<TElement>[] = [];

    const refSpec = ((
      lifecycleCallback: LifecycleCallback<TElement>
    ): RefSpec<TElement> => {
      lifecycleCallbacks.push(lifecycleCallback);
      return refSpec; // Chainable
    }) as RefSpec<TElement>;

    refSpec.create = <TExt>(
      extensions?: TExt
    ): MatchFragRef<TElement> & TExt => {
      const fragRef: MatchFragRef<TElement> = {
        status: STATUS_FRAGMENT,
        element: undefined,
        prev: undefined,
        next: undefined,
        firstChild: undefined,
        lastChild: undefined,
        ...extensions, // Spread extensions to override/add fields
        attach: (parent, nextSibling): void => {
          // Store parent element for reconciliation (extract from parent NodeRef)
          // Parent is always an ElementRef in practice (fragments can't be parents)
          const parentElement = parent.element;
          fragRef.element = parentElement;

          // Store boundary marker if provided (for standalone usage)
          // When created via el(), state.next will be set and takes precedence
          if (nextSibling && !fragRef.next) {
            fragRef.next = nextSibling;
          }

          // Create effect that swaps elements when reactive value changes
          const dispose = effect(() => {
            const value = reactive();
            const elementRef = render(value);

            // Remove old child if exists
            if (fragRef.firstChild) {
              const oldElement = fragRef.firstChild.element;
              const oldScope = ctx.elementScopes.get(oldElement);
              if (oldScope) {
                disposeScope(oldScope);
                ctx.elementScopes.delete(oldElement);
              }
              renderer.removeChild(parentElement, oldElement);
              fragRef.firstChild = undefined;
              fragRef.lastChild = undefined;
            }

            // Create new child if not null/false
            if (elementRef && isRefSpec(elementRef)) {
              const nodeRef = elementRef.create();
              // Match children should be ElementRefs
              if (isElementRef(nodeRef)) {
                // Store NodeRef to prevent memory leaks
                fragRef.firstChild = nodeRef;
                fragRef.lastChild = nodeRef;
                // Insert before next sibling element to maintain stable position
                renderer.insertBefore(
                  parentElement,
                  nodeRef.element,
                  resolveNextElement(fragRef.next as NodeRef<TElement>)
                );
              }
            }
          });

          const parentScope = ctx.elementScopes.get(parentElement);
          if (parentScope) trackInSpecificScope(parentScope, { dispose });
        },
      };

      return fragRef as MatchFragRef<TElement> & TExt;
    };

    return refSpec;
  }

  return {
    name: 'match',
    method: match,
  };
}
