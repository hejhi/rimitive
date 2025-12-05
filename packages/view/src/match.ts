import type {
  ServiceDefinition,
  InstrumentationContext,
  ServiceContext,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import type { RefSpec, Writable, FragmentRef, ElementRef } from './types';
import { STATUS_REF_SPEC, STATUS_FRAGMENT } from './types';
import type { Adapter, AdapterConfig } from './adapter';
import type { CreateScopes } from './helpers/scope';
import { createNodeHelpers } from './helpers/node-helpers';
import { setFragmentChild } from './helpers/fragment-boundaries';

/**
 * Options passed to Match factory
 */
export type MatchOpts<TConfig extends AdapterConfig> = {
  disposeScope: CreateScopes['disposeScope'];
  scopedEffect: CreateScopes['scopedEffect'];
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
 * Match factory type - reactive element switching based on a reactive value
 *
 * Takes a signal, computed, or () =\> T and a matcher function.
 * When the reactive value changes, the current element is disposed and
 * replaced with a new one from the matcher.
 *
 * The matcher function is NOT a reactive scope - it's a pure function that
 * receives the current value and returns a RefSpec.
 *
 * Uses function overloads with Writable<T> first to ensure proper
 * type inference when passing signals directly (without arrow function wrapper).
 *
 * @example
 * ```ts
 * // Signal passed directly - type infers correctly
 * match(dialog.isOpen, (isOpen) =>
 *   isOpen ? OpenDialog() : null
 * )
 *
 * // Computed or arrow function also works
 * match(currentTab, (tab) =>
 *   tab === 'home' ? HomePage() : SettingsPage()
 * )
 * ```
 */
export type MatchFactory<TBaseElement> = ServiceDefinition<
  'match',
  {
    // Overload 1: Writable<T> (signal-like) - must be first for proper inference
    <T, TElement extends TBaseElement>(
      reactive: Writable<T>,
      matcher: (value: T) => RefSpec<TElement> | null
    ): RefSpec<TElement>;
    // Overload 2: Plain getter () => T (computed, arrow functions)
    <T, TElement extends TBaseElement>(
      reactive: () => T,
      matcher: (value: T) => RefSpec<TElement> | null
    ): RefSpec<TElement>;
  }
>;

/**
 * The instantiable service returned by Match().
 *
 * Use this type when building custom view service compositions:
 * @example
 * ```ts
 * import { Match, type MatchService } from '@lattice/view/match';
 *
 * const matchService: MatchService<DOMAdapterConfig> = Match<DOMAdapterConfig>();
 * const factory = matchService.create(opts); // MatchFactory<HTMLElement>
 * ```
 */
export type MatchService<TConfig extends AdapterConfig> = ReturnType<
  typeof Match<TConfig>
>;

/**
 * Match primitive - switches between different elements based on reactive value
 *
 * Takes a Reactive<T> (signal, computed, or any () =\> T) and rebuilds children
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
 * match(currentTab, (tab) =>
 *   tab === 'home' ? HomePage() : SettingsPage()
 * )
 *
 * // With computed
 * const viewMode = computed(() => user().isAdmin ? 'admin' : 'user');
 * match(viewMode, (mode) =>
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
    disposeScope,
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
       * Helper to create a RefSpec for fragments
       */
      const createMatchSpec = <TElement>(
        createFragmentFn: (svc?: unknown) => TFragRef
      ): RefSpec<TElement> => {
        const refSpec = (() => refSpec) as unknown as RefSpec<TElement>;

        refSpec.status = STATUS_REF_SPEC;
        refSpec.create = <TExt>(svc?: unknown, extensions?: TExt) => {
          const fragRef = createFragmentFn(svc);
          if (!extensions || Object.keys(extensions).length === 0)
            return fragRef as FragmentRef<TElement> & TExt;

          return {
            ...fragRef,
            ...extensions,
          } as FragmentRef<TElement> & TExt;
        };

        return refSpec;
      };

      // Overload signatures for proper type inference
      function match<T, TElement extends TBaseElement>(
        reactive: Writable<T>,
        matcher: (value: T) => RefSpec<TElement> | null
      ): RefSpec<TElement>;
      function match<T, TElement extends TBaseElement>(
        reactive: () => T,
        matcher: (value: T) => RefSpec<TElement> | null
      ): RefSpec<TElement>;
      // Implementation signature
      function match<T, TElement extends TBaseElement>(
        reactive: Writable<T> | (() => T),
        matcher: (value: T) => RefSpec<TElement> | null
      ): RefSpec<TElement> {
        return createMatchSpec<TElement>((svc) => {
          const fragment: FragmentRef<TBaseElement> = {
            status: STATUS_FRAGMENT,
            element: null,
            parent: null,
            prev: null,
            next: null,
            firstChild: null,
            lastChild: null,
            attach(parent, nextSibling) {
              let currentNode: ElementRef<TBaseElement> | TFragRef | undefined;
              let currentValue: T | undefined;
              let isFirstRun = true;

              // Update function - called when reactive value changes
              const updateElement = (value: T) => {
                // Skip update if value hasn't changed (after first run)
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
                  setFragmentChild(fragment, null);
                  currentNode = undefined;
                  return;
                }

                // Create the element/fragment from the spec
                const nodeRef = refSpec.create(svc);
                setFragmentChild(fragment, nodeRef);
                currentNode = nodeRef;

                // Insert into DOM
                insertNodeBefore(
                  svc,
                  parent.element,
                  nodeRef,
                  undefined,
                  nextSibling
                );
              };

              // Effect tracks the reactive value, then calls updateElement
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
      }

      const extension: MatchFactory<TBaseElement> = {
        name: 'match',
        impl: match,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
