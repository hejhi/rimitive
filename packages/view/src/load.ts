/**
 * Async data loading boundaries
 *
 * load() creates async boundaries with a fetcher/renderer pattern.
 * Internally uses match() for reactive content swapping.
 * SSR introspection via Symbol-keyed metadata.
 */

import type { RefSpec, FragmentRef } from './types';
import type { Adapter, AdapterConfig } from './adapter';
import type { CreateScopes } from './deps/scope';
import { ScopesModule } from './deps/scope';
import { createMatchFactory } from './match';
import { defineModule, type Module } from '@lattice/lattice';
import { SignalModule, type SignalFactory } from '@lattice/signals/signal';

// =============================================================================
// Types
// =============================================================================

/**
 * Load state - discriminated union for async load boundaries
 *
 * @example
 * ```ts
 * load(
 *   () => fetchData(),
 *   (state) => {
 *     switch (state.status) {
 *       case 'pending': return el('div')('Loading...');
 *       case 'error': return el('div')(`Error: ${state.error}`);
 *       case 'ready': return DataView(state.data);
 *     }
 *   }
 * )
 * ```
 */
export type LoadState<T> =
  | { status: 'pending' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: unknown };

// =============================================================================
// Async Fragment API
// =============================================================================

/** Symbol marking async fragments created by load() */
export const ASYNC_FRAGMENT = Symbol.for('lattice.async-fragment');

/** Async fragment metadata for SSR introspection */
export type AsyncMeta<T = unknown> = {
  readonly id: string;
  readonly resolve: () => Promise<{ data: T; refSpec: RefSpec<unknown> }>;
  readonly getData: () => T | undefined;
  readonly setData: (data: T) => void;
  readonly isResolved: () => boolean;
  readonly trigger: () => void;
};

/** Fragment with async metadata */
export type AsyncFragment<TElement = unknown, T = unknown> = FragmentRef<TElement> & {
  [ASYNC_FRAGMENT]: AsyncMeta<T>;
};

/** Check if a value is an async fragment */
export function isAsyncFragment(value: unknown): value is AsyncFragment {
  return typeof value === 'object' && value !== null && ASYNC_FRAGMENT in value;
}

/** Get async metadata from a fragment */
export function getAsyncMeta<T>(fragment: FragmentRef<unknown>): AsyncMeta<T> | undefined {
  return (fragment as Partial<AsyncFragment>)[ASYNC_FRAGMENT] as AsyncMeta<T> | undefined;
}

// =============================================================================
// Load Factory
// =============================================================================

export type LoadOptions = { id?: string };

/**
 * Load factory type - creates async boundaries with fetcher/renderer pattern
 *
 * @example
 * ```ts
 * load(
 *   () => fetch('/api/data').then(r => r.json()),
 *   (state) => {
 *     switch (state.status) {
 *       case 'pending': return el('div')('Loading...');
 *       case 'error': return el('div')(`Error: ${state.error}`);
 *       case 'ready': return DataView(state.data);
 *     }
 *   }
 * )
 * ```
 */
export type LoadFactory<TBaseElement> = <T, TElement extends TBaseElement>(
  fetcher: () => Promise<T>,
  renderer: (state: LoadState<T>) => RefSpec<TElement>,
  options?: LoadOptions
) => RefSpec<TElement>;

/**
 * The load service type - alias for LoadFactory for discoverability.
 *
 * Use this type when building custom view service compositions:
 * @example
 * ```ts
 * import { createLoadFactory, type LoadService } from '@lattice/view/load';
 *
 * const load: LoadService<DOMAdapterConfig> = createLoadFactory(opts);
 * ```
 */
export type LoadService<TConfig extends AdapterConfig> = LoadFactory<
  TConfig['baseElement']
>;

/**
 * Options for createLoadFactory
 */
export type LoadOpts<TConfig extends AdapterConfig> = {
  signal: SignalFactory;
  disposeScope: CreateScopes['disposeScope'];
  scopedEffect: CreateScopes['scopedEffect'];
  getElementScope: CreateScopes['getElementScope'];
  adapter: Adapter<TConfig>;
};

let idCounter = 0;

/**
 * Create a load factory with the given dependencies.
 *
 * @example
 * ```ts
 * import { createLoadFactory } from '@lattice/view/load';
 *
 * const load = createLoadFactory({
 *   signal,
 *   adapter,
 *   ...scopes,
 * });
 *
 * const asyncContent = load(
 *   () => fetchData(),
 *   (state) => state.status === 'ready' ? Content(state.data) : Loading()
 * );
 * ```
 */
export function createLoadFactory<TConfig extends AdapterConfig>({
  signal,
  adapter,
  disposeScope,
  scopedEffect,
  getElementScope,
}: LoadOpts<TConfig>): LoadFactory<TConfig['baseElement']> {
  type TBaseElement = TConfig['baseElement'];

  const match = createMatchFactory<TConfig>({
    adapter,
    disposeScope,
    scopedEffect,
    getElementScope,
  });

  function load<T, TElement extends TBaseElement>(
    fetcher: () => Promise<T>,
    renderer: (state: LoadState<T>) => RefSpec<TElement>,
    options?: LoadOptions
  ): RefSpec<TElement> {
    const id = options?.id ?? `load-${++idCounter}`;
    const state = signal<LoadState<T>>({ status: 'pending' });
    const matchSpec = match(state, renderer);

    // Closure state
    let data: T | undefined;
    let resolved = false;

    const meta: AsyncMeta<T> = {
      id,
      resolve: async () => {
        if (resolved && data !== undefined) {
          return { data, refSpec: renderer({ status: 'ready', data }) };
        }
        try {
          const result = await fetcher();
          data = result;
          resolved = true;
          return { data: result, refSpec: renderer({ status: 'ready', data: result }) };
        } catch (error) {
          resolved = true;
          return { data: undefined as T, refSpec: renderer({ status: 'error', error }) };
        }
      },
      getData: () => data,
      setData: (d: T) => {
        data = d;
        resolved = true;
        state({ status: 'ready', data: d });
      },
      isResolved: () => resolved,
      trigger: () => {
        if (resolved) return;
        fetcher().then(
          (result) => {
            data = result;
            resolved = true;
            state({ status: 'ready', data: result });
          },
          (error) => {
            resolved = true;
            state({ status: 'error', error });
          }
        );
      },
    };

    return {
      status: matchSpec.status,
      create: <TExt>(svc?: unknown, extensions?: TExt) => {
        const fragment = matchSpec.create(svc, extensions);
        (fragment as AsyncFragment<TElement, T>)[ASYNC_FRAGMENT] = meta;
        if (resolved && data !== undefined) {
          state({ status: 'ready', data });
        }
        return fragment;
      },
    } as RefSpec<TElement>;
  }

  return load;
}

// =============================================================================
// Module Definition
// =============================================================================

/**
 * Create a Load module for a given adapter.
 *
 * The adapter is configuration, not a module, so this is a factory
 * that returns a module parameterized by the adapter.
 *
 * @example
 * ```ts
 * import { compose } from '@lattice/lattice';
 * import { createLoadModule } from '@lattice/view/load';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 *
 * const adapter = createDOMAdapter();
 * const LoadModule = createLoadModule(adapter);
 *
 * const { load } = compose(LoadModule)();
 * ```
 */
export const createLoadModule = <TConfig extends AdapterConfig>(
  adapter: Adapter<TConfig>
): Module<
  'load',
  LoadFactory<TConfig['baseElement']>,
  { signal: SignalFactory; scopes: CreateScopes }
> =>
  defineModule({
    name: 'load',
    dependencies: [SignalModule, ScopesModule],
    create: ({ signal, scopes }: { signal: SignalFactory; scopes: CreateScopes }) =>
      createLoadFactory({ signal, adapter, ...scopes }),
  });
