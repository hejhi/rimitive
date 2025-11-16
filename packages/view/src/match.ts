import type { LatticeExtension, InstrumentationContext, ExtensionContext } from '@lattice/lattice';
import { create } from '@lattice/lattice';
import type {
  LifecycleCallback,
  RefSpec,
  Reactive,
  FragmentRef,
  ElementRef,
} from './types';
import { STATUS_ELEMENT, STATUS_REF_SPEC, STATUS_FRAGMENT } from './types';
import type { Renderer, RendererConfig } from './renderer';
import type { CreateScopes } from './helpers/scope';
import { createFragmentHelpers } from './helpers/fragment';
import { createNodeHelpers } from './helpers/node-helpers';

const { createFragment } = createFragmentHelpers();

/**
 * Options passed to Match factory
 */
export type MatchOpts<TConfig extends RendererConfig> = {
  createElementScope: CreateScopes['createElementScope'];
  disposeScope: CreateScopes['disposeScope'];
  scopedEffect: CreateScopes['scopedEffect'];
  onCleanup: CreateScopes['onCleanup'];
  getElementScope: CreateScopes['getElementScope'];
  renderer: Renderer<TConfig>;
};

export type MatchProps<TBaseElement> = {
  instrument?: (
    method: MatchFactory<TBaseElement>['method'],
    instrumentation: InstrumentationContext,
    context: ExtensionContext
  ) => MatchFactory<TBaseElement>['method'];
};

/**
 * Match factory type - reactive element switching based on a reactive value
 *
 * The matcher function is NOT a reactive scope - it's a pure function that
 * receives the current value and returns a RefSpec. The reactivity is handled
 * by match itself.
 *
 * Generic over:
 * - T: The reactive value type
 * - TElement: The element type (must extend base element from renderer config)
 */
export type MatchFactory<TBaseElement> = LatticeExtension<
  'match',
  {
    <T, TElement extends TBaseElement>(
      reactive: Reactive<T>
    ): (
      matcher: (value: T) => RefSpec<TElement> | null
    ) => RefSpec<TElement>;
  }
>;

/**
 * Match primitive - switches between different elements based on reactive value
 *
 * Usage:
 * ```typescript
 * // Pattern 1: Conditional element type
 * match(showDiv)((show) =>
 *   show
 *     ? el('div', { className: 'card' })(children)
 *     : el('span', { className: 'inline' })(children)
 * )(sharedLifecycle)
 *
 * // Pattern 2: Dynamic tag selection
 * match(headingLevel)((level) =>
 *   el(level > 2 ? 'h3' : 'h1', { className: 'title' })(children)
 * )(sharedLifecycle)
 * ```
 *
 * The matcher function is called with the current reactive value and must return
 * a RefSpec. It is NOT a reactive tracking scope - it's a pure mapping function.
 */
export const Match = create(
  <TConfig extends RendererConfig>({
    scopedEffect,
    renderer,
    createElementScope,
    disposeScope,
    onCleanup,
    getElementScope,
  }: MatchOpts<TConfig>) =>
    (props?: MatchProps<TConfig['baseElement']>) => {
      type TBaseElement = TConfig['baseElement'];
      type TFragRef = FragmentRef<TBaseElement>;

      const { instrument } = props ?? {};
      const { insertNodeBefore, removeNode } = createNodeHelpers({
        renderer,
        disposeScope,
        getElementScope,
      });

      /**
       * Helper to create a RefSpec that accumulates lifecycle callbacks
       * and returns a FragmentRef on creation
       */
      const createMatchSpec = <TElement>(
        createFragmentFn: (
          lifecycleCallbacks: LifecycleCallback<TElement>[],
          api?: unknown
        ) => TFragRef
      ): RefSpec<TElement> => {
        const lifecycleCallbacks: LifecycleCallback<TElement>[] = [];

        const refSpec: RefSpec<TElement> = (
          ...callbacks: LifecycleCallback<TElement>[]
        ) => {
          lifecycleCallbacks.push(...callbacks);
          return refSpec;
        };

        refSpec.status = STATUS_REF_SPEC;
        refSpec.create = <TExt>(
          api?: unknown,
          extensions?: TExt
        ) => {
          const fragRef = createFragmentFn(lifecycleCallbacks, api);
          return {
            ...fragRef,
            ...extensions
          } as FragmentRef<TElement> & TExt;
        };

        return refSpec;
      };

      function match<T, TElement extends TBaseElement>(
        reactive: Reactive<T>
      ): (matcher: (value: T) => RefSpec<TElement> | null) => RefSpec<TElement> {
        return (matcher: (value: T) => RefSpec<TElement> | null) => {
          return createMatchSpec<TElement>((lifecycleCallbacks, api) => {
            const fragRef = createFragment<TBaseElement>((parent, nextSibling) => {
              let currentNode: ElementRef<TBaseElement> | TFragRef | undefined;

              // Run lifecycle callbacks for element
              const runLifecycleCallbacks = (element: TElement) => {
                createElementScope(element, () => {
                  for (const callback of lifecycleCallbacks) {
                    const cleanup = callback(element);
                    if (cleanup) onCleanup(cleanup);
                  }
                });
              };

              // Update function - called when reactive value changes
              const updateElement = (value: T) => {
                // Clean up old element or fragment
                if (currentNode) removeNode(parent.element, currentNode);

                // Get RefSpec from matcher (pure function call)
                const refSpec = matcher(value);

                if (refSpec === null) {
                  fragRef.firstChild = undefined;
                  fragRef.lastChild = undefined;
                  currentNode = undefined;
                  return;
                }

                // Create the element/fragment from the spec
                const nodeRef = refSpec.create(api);

                if (nodeRef.status !== STATUS_ELEMENT && nodeRef.status !== STATUS_FRAGMENT) {
                  throw new Error('match() only supports ElementRef and FragmentRef, not CommentRef');
                }

                if (nodeRef.status === STATUS_FRAGMENT) {
                  fragRef.firstChild = nodeRef.firstChild;
                  fragRef.lastChild = nodeRef.lastChild;
                } else {
                  fragRef.firstChild = nodeRef;
                  fragRef.lastChild = nodeRef;
                }

                currentNode = nodeRef;

                // Execute lifecycle callbacks from match level
                if (nodeRef.status === STATUS_ELEMENT) {
                  runLifecycleCallbacks((nodeRef as ElementRef<TElement>).element);
                }

                // Insert into DOM
                insertNodeBefore(
                  api,
                  parent.element,
                  nodeRef,
                  undefined,
                  nextSibling
                );
              };

              // Effect only tracks the reactive value, then calls updateElement
              // Use nested effect to isolate updateElement from tracking
              // The inner effect creates a tracking boundary, then we dispose it
              return scopedEffect(() => {
                const value = reactive();
                const isolate = scopedEffect(() => {
                  updateElement(value);
                });
                isolate(); // Dispose immediately after it runs
              });
            });

            return fragRef;
          });
        };
      }

      const extension: MatchFactory<TBaseElement> = {
        name: 'match',
        method: match,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
