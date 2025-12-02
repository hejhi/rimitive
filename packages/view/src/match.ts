import type {
  ServiceDefinition,
  InstrumentationContext,
  ServiceContext,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import type {
  LifecycleCallback,
  RefSpec,
  Reactive,
  FragmentRef,
  ElementRef,
} from './types';
import { STATUS_ELEMENT, STATUS_REF_SPEC, STATUS_FRAGMENT } from './types';
import type { Adapter, AdapterConfig } from './adapter';
import type { CreateScopes } from './helpers/scope';
import { createNodeHelpers } from './helpers/node-helpers';

/**
 * Options passed to Match factory
 */
export type MatchOpts<TConfig extends AdapterConfig> = {
  createElementScope: CreateScopes['createElementScope'];
  disposeScope: CreateScopes['disposeScope'];
  scopedEffect: CreateScopes['scopedEffect'];
  onCleanup: CreateScopes['onCleanup'];
  getElementScope: CreateScopes['getElementScope'];
  adapter: Adapter<TConfig>;
};

export type MatchProps<TBaseElement> = {
  instrument?: (
    impl: MatchFactory<TBaseElement>['impl'],
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => MatchFactory<TBaseElement>['impl'];
};

/**
 * Match factory type - reactive element switching based on a Reactive<T>
 *
 * Takes a Reactive<T> (signal, computed, or () => T) and a matcher function.
 * When the reactive value changes, the current element is disposed and
 * replaced with a new one from the matcher.
 *
 * The matcher function is NOT a reactive scope - it's a pure function that
 * receives the current value and returns a RefSpec.
 *
 * Generic over:
 * - T: The reactive value type
 * - TElement: The element type (must extend base element from renderer config)
 */
export type MatchFactory<TBaseElement> = ServiceDefinition<
  'match',
  {
    <T, TElement extends TBaseElement>(
      reactive: Reactive<T>
    ): (matcher: (value: T) => RefSpec<TElement> | null) => RefSpec<TElement>;
  }
>;

/**
 * Match primitive - switches between different elements based on reactive value
 *
 * Takes a Reactive<T> (signal, computed, or any () => T) and rebuilds children
 * when the value changes. Use for polymorphic rendering where the value
 * determines WHAT to render.
 *
 * For simple show/hide based on truthiness, use when() instead - it's more
 * efficient as it doesn't rebuild the parent.
 *
 * Usage:
 * ```typescript
 * const currentTab = signal<'home' | 'settings'>('home');
 *
 * // Switch between different views based on tab
 * match(currentTab)((tab) =>
 *   tab === 'home' ? HomePage() : SettingsPage()
 * )
 *
 * // With computed
 * const viewMode = computed(() => user().isAdmin ? 'admin' : 'user');
 * match(viewMode)((mode) =>
 *   mode === 'admin' ? AdminPanel() : UserPanel()
 * )
 * ```
 *
 * The matcher function is called with the current reactive value and must return
 * a RefSpec. It is NOT a reactive tracking scope - it's a pure mapping function.
 */
export const Match = defineService(
  <TConfig extends AdapterConfig>({
    scopedEffect,
    adapter,
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
        adapter,
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
        refSpec.create = <TExt>(api?: unknown, extensions?: TExt) => {
          const fragRef = createFragmentFn(lifecycleCallbacks, api);
          // If no extensions, return the ref directly to preserve mutability
          if (!extensions || Object.keys(extensions).length === 0)
            return fragRef as FragmentRef<TElement> & TExt;

          return {
            ...fragRef,
            ...extensions,
          } as FragmentRef<TElement> & TExt;
        };

        return refSpec;
      };

      function match<T, TElement extends TBaseElement>(
        reactive: Reactive<T>
      ): (
        matcher: (value: T) => RefSpec<TElement> | null
      ) => RefSpec<TElement> {
        return (matcher: (value: T) => RefSpec<TElement> | null) => {
          return createMatchSpec<TElement>((lifecycleCallbacks) => {
            const fragment: FragmentRef<TBaseElement> = {
              status: STATUS_FRAGMENT,
              element: null,
              parent: null,
              prev: null,
              next: null,
              firstChild: null,
              lastChild: null,
              attach(parent, nextSibling, api) {
                let currentNode:
                  | ElementRef<TBaseElement>
                  | TFragRef
                  | undefined;
                let currentValue: T | undefined;
                let isFirstRun = true;

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
                  // Skip update if value hasn't changed (after first run)
                  // This prevents unnecessary teardown/recreation when the
                  // matched value stays the same
                  if (!isFirstRun && value === currentValue) {
                    return;
                  }
                  isFirstRun = false;
                  currentValue = value;

                  // Clean up old element or fragment
                  if (currentNode) removeNode(parent.element, currentNode);

                  // Get RefSpec from matcher (pure function call)
                  const refSpec = matcher(value);

                  if (refSpec === null) {
                    fragment.firstChild = null;
                    fragment.lastChild = null;
                    currentNode = undefined;
                    return;
                  }

                  // Create the element/fragment from the spec
                  const nodeRef = refSpec.create(api);

                  if (nodeRef.status === STATUS_FRAGMENT) {
                    fragment.firstChild = nodeRef.firstChild;
                    fragment.lastChild = nodeRef.lastChild;
                  } else {
                    fragment.firstChild = nodeRef;
                    fragment.lastChild = nodeRef;
                  }

                  currentNode = nodeRef;

                  // Execute lifecycle callbacks from match level
                  if (nodeRef.status === STATUS_ELEMENT) {
                    runLifecycleCallbacks(nodeRef.element);
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
              },
            };
            return fragment;
          });
        };
      }

      const extension: MatchFactory<TBaseElement> = {
        name: 'match',
        impl: match,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
