/**
 * Error boundary primitive - catches errors in child subtree and renders fallback UI
 *
 * errorBoundary(children, fallback) catches synchronous errors thrown during
 * children.create() and renders the fallback instead. The fallback receives a
 * reactive error value so fallback UI can display error details.
 *
 * Works with the adapter system (no DOM assumptions) and composes via defineModule().
 * SSR introspection via ERROR_BOUNDARY symbol metadata enables streaming error recovery.
 */

import type { RefSpec, FragmentRef, ElementRef, NodeRef, Reactive } from './types';
import { STATUS_REF_SPEC, STATUS_FRAGMENT } from './types';
import type { Adapter, TreeConfig, NodeOf } from './adapter';
import type { CreateScopes } from './deps/scope';
import { ScopesModule } from './deps/scope';
import { createNodeHelpers } from './deps/node-deps';
import { setFragmentChild } from './deps/fragment-boundaries';
import {
  defineModule,
  type Module,
  STATUS_MODULE,
  PLACEHOLDER,
} from '@rimitive/core';
import { SignalModule, type SignalFactory } from '@rimitive/signals/signal';

// =============================================================================
// Types
// =============================================================================

/** Symbol marking error boundary fragments */
export const ERROR_BOUNDARY = Symbol.for('rimitive.error-boundary');

/** Error boundary metadata for SSR introspection */
export type ErrorBoundaryMeta = {
  /** Set the error and trigger fallback rendering */
  setError: (error: unknown) => void;
  /** Whether this boundary has caught an error */
  hasError: () => boolean;
};

/** Node with error boundary metadata */
export type ErrorBoundaryFragment<TElement = unknown> = NodeRef<TElement> & {
  [ERROR_BOUNDARY]: ErrorBoundaryMeta;
};

/** Check if a value is an error boundary fragment */
export function isErrorBoundaryFragment(
  value: unknown
): value is ErrorBoundaryFragment {
  return (
    typeof value === 'object' && value !== null && ERROR_BOUNDARY in value
  );
}

/** Get error boundary metadata from a node */
export function getErrorBoundaryMeta(
  node: NodeRef<unknown>
): ErrorBoundaryMeta | undefined {
  return (node as Partial<ErrorBoundaryFragment>)[ERROR_BOUNDARY];
}

// =============================================================================
// Error Boundary Factory
// =============================================================================

/**
 * Error boundary factory type - catches errors in child subtree, renders fallback
 *
 * @example
 * ```ts
 * const { errorBoundary, el } = svc;
 *
 * errorBoundary(
 *   DangerousWidget(),
 *   (error) => el('div')(() => String(error()))
 * );
 * ```
 */
export type ErrorBoundaryFactory<TBaseElement> = <
  TElement extends TBaseElement,
>(
  children: RefSpec<TElement>,
  fallback: (error: Reactive<unknown>) => RefSpec<TElement>
) => RefSpec<TElement>;

/**
 * Options passed to error boundary factory
 */
export type ErrorBoundaryOpts<TConfig extends TreeConfig> = {
  disposeScope: CreateScopes['disposeScope'];
  scopedEffect: CreateScopes['scopedEffect'];
  getElementScope: CreateScopes['getElementScope'];
  withScope: CreateScopes['withScope'];
  createChildScope: CreateScopes['createChildScope'];
  adapter: Adapter<TConfig>;
  signal: SignalFactory;
};

/**
 * The service type returned by createErrorBoundaryFactory.
 *
 * @example
 * ```ts
 * import { createErrorBoundaryFactory, type ErrorBoundaryService } from '@rimitive/view/error-boundary';
 *
 * const factory: ErrorBoundaryService<DOMTreeConfig> = createErrorBoundaryFactory(opts);
 * ```
 */
export type ErrorBoundaryService<TConfig extends TreeConfig> =
  ErrorBoundaryFactory<NodeOf<TConfig>>;

/**
 * Create an error boundary factory with the given options.
 *
 * Catches synchronous errors thrown during children.create() and renders
 * a fallback instead. The fallback receives a reactive error signal.
 *
 * Attaches ERROR_BOUNDARY metadata to the fragment for SSR introspection.
 *
 * @example
 * ```ts
 * const errorBoundary = createErrorBoundaryFactory({
 *   adapter, signal, disposeScope, scopedEffect,
 *   getElementScope, withScope, createChildScope,
 * });
 *
 * errorBoundary(
 *   riskyComponent(),
 *   (error) => el('div')(() => `Error: ${error()}`)
 * );
 * ```
 */
export function createErrorBoundaryFactory<TConfig extends TreeConfig>(
  opts: ErrorBoundaryOpts<TConfig>
): ErrorBoundaryFactory<NodeOf<TConfig>> {
  const { adapter, signal, disposeScope, getElementScope, withScope, createChildScope } = opts;
  type TBaseElement = NodeOf<TConfig>;
  type TFragRef = FragmentRef<TBaseElement>;

  const { insertNodeBefore, removeNode } = createNodeHelpers({
    adapter,
    disposeScope,
    getElementScope,
  });

  /**
   * Helper to create a RefSpec for error boundary fragments
   */
  const createBoundarySpec = <TElement>(
    createFragmentFn: (svc?: unknown) => TFragRef,
    meta: ErrorBoundaryMeta
  ): RefSpec<TElement> => {
    const refSpec = (() => refSpec) as unknown as RefSpec<TElement>;

    refSpec.status = STATUS_REF_SPEC;
    refSpec.create = <TExt>(svc?: unknown, extensions?: TExt) => {
      const fragRef = createFragmentFn(svc);

      // Attach error boundary metadata for SSR introspection
      (fragRef as ErrorBoundaryFragment<TBaseElement>)[ERROR_BOUNDARY] = meta;

      if (!extensions || Object.keys(extensions).length === 0)
        return fragRef as FragmentRef<TElement> & TExt;

      return {
        ...fragRef,
        ...extensions,
      } as FragmentRef<TElement> & TExt;
    };

    return refSpec;
  };

  function errorBoundary<TElement extends TBaseElement>(
    children: RefSpec<TElement>,
    fallback: (error: Reactive<unknown>) => RefSpec<TElement>
  ): RefSpec<TElement> {
    // Create error signal once at boundary creation time
    const errorSignal = signal<unknown>(undefined);
    let hasCaughtError = false;

    const meta: ErrorBoundaryMeta = {
      setError: (err: unknown) => {
        hasCaughtError = true;
        errorSignal(err);
      },
      hasError: () => hasCaughtError,
    };

    // Build fallback spec eagerly (just the spec, not the nodes)
    // This matches load()'s pattern of calling the renderer once
    const fallbackSpec = fallback(errorSignal as Reactive<unknown>);

    return createBoundarySpec<TElement>(
      (svc) => {
        const fragment: FragmentRef<TBaseElement> = {
          status: STATUS_FRAGMENT,
          element: null,
          parent: null,
          prev: null,
          next: null,
          firstChild: null,
          lastChild: null,
          attach(
            parent: ElementRef<TBaseElement>,
            nextSibling: NodeRef<TBaseElement> | null
          ) {
            const childScope = createChildScope();

            try {
              // Attempt to create children within a scope
              const childNode = withScope(childScope, () =>
                children.create(svc)
              );
              setFragmentChild(fragment, childNode);

              // Insert into tree
              insertNodeBefore(
                svc,
                parent.element,
                childNode,
                undefined,
                nextSibling
              );

              // Return cleanup for normal (no-error) path
              return () => {
                disposeScope(childScope);
                removeNode(parent.element, childNode);
              };
            } catch (err) {
              // Dispose errored child scope
              disposeScope(childScope);

              // Set error signal
              hasCaughtError = true;
              errorSignal(err);

              // Create fallback in a new scope
              const fallbackScope = createChildScope();
              const fallbackNode = withScope(fallbackScope, () =>
                fallbackSpec.create(svc)
              );
              setFragmentChild(fragment, fallbackNode);

              // Insert fallback into tree
              insertNodeBefore(
                svc,
                parent.element,
                fallbackNode,
                undefined,
                nextSibling
              );

              // Return cleanup for fallback path
              return () => {
                disposeScope(fallbackScope);
                removeNode(parent.element, fallbackNode);
              };
            }
          },
        };
        return fragment;
      },
      meta
    );
  }

  return errorBoundary;
}

// =============================================================================
// Module Definition
// =============================================================================

/**
 * Placeholder module for use in dependency arrays.
 * The actual module is created via ErrorBoundaryModule.with({ adapter }).
 */
const errorBoundaryModulePlaceholder = {
  status: STATUS_MODULE as typeof STATUS_MODULE,
  name: 'errorBoundary' as const,
  dependencies: [ScopesModule, SignalModule],
  [PLACEHOLDER]: true as const,
  create: (): ErrorBoundaryFactory<Node> => {
    throw new Error(
      'Module "errorBoundary" requires configuration. ' +
        'Use ErrorBoundaryModule.with({ adapter }) when composing.'
    );
  },
};

/**
 * Error boundary module - catches errors in child subtrees and renders fallback UI.
 *
 * Requires configuration via .with() before composing.
 * Use ErrorBoundaryModule.module in dependency arrays to declare dependency.
 *
 * @example
 * ```ts
 * import { compose } from '@rimitive/core';
 * import { ErrorBoundaryModule } from '@rimitive/view/error-boundary';
 * import { createDOMAdapter } from '@rimitive/view/adapters/dom';
 *
 * const adapter = createDOMAdapter();
 * const svc = compose(
 *   SignalModule,
 *   EffectModule,
 *   ErrorBoundaryModule.with({ adapter }),
 * );
 *
 * const { errorBoundary } = svc;
 * ```
 */
export const ErrorBoundaryModule = {
  name: 'errorBoundary' as const,
  module: errorBoundaryModulePlaceholder,

  with<TConfig extends TreeConfig>(config: {
    adapter: Adapter<TConfig>;
  }): Module<
    'errorBoundary',
    ErrorBoundaryFactory<NodeOf<TConfig>>,
    { scopes: CreateScopes; signal: SignalFactory }
  > {
    return defineModule({
      name: 'errorBoundary',
      dependencies: [ScopesModule, SignalModule],
      create: ({
        scopes,
        signal,
      }: {
        scopes: CreateScopes;
        signal: SignalFactory;
      }) =>
        createErrorBoundaryFactory({
          adapter: config.adapter,
          signal,
          ...scopes,
        }),
    });
  },
};
