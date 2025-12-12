/**
 * Async data loading boundaries
 *
 * load() creates async boundaries with a fetcher/renderer pattern.
 * The renderer receives a state object with reactive properties (status, data, error).
 * User controls reactivity - typically using match() on state.status.
 * SSR introspection via Symbol-keyed metadata.
 */

import type { RefSpec, NodeRef, Reactive } from './types';
import { STATUS_REF_SPEC } from './types';
import { ScopesModule } from './deps/scope';
import { defineModule, type Module } from '@lattice/lattice';
import { SignalModule, type SignalFactory } from '@lattice/signals/signal';

// =============================================================================
// Types
// =============================================================================

/** Load status values */
export type LoadStatus = 'pending' | 'ready' | 'error';

/**
 * Load state object with reactive properties
 *
 * @example
 * ```ts
 * load(
 *   () => fetchData(),
 *   (state) => match(state.status, (status) => {
 *     switch (status) {
 *       case 'pending': return el('div')('Loading...');
 *       case 'error': return el('div')(`Error: ${state.error()}`);
 *       case 'ready': return DataView(state.data()!);
 *     }
 *   })
 * )
 * ```
 */
export type LoadState<T> = {
  readonly status: Reactive<LoadStatus>;
  readonly data: Reactive<T | undefined>;
  readonly error: Reactive<unknown | undefined>;
};

// =============================================================================
// Async Fragment API
// =============================================================================

/** Symbol marking async fragments created by load() */
export const ASYNC_FRAGMENT = Symbol.for('lattice.async-fragment');

/** Async fragment metadata for SSR introspection */
export type AsyncMeta<T = unknown> = {
  /** ID for this async boundary (only present when created via createLoader) */
  readonly id?: string;
  readonly resolve: () => Promise<T>;
  readonly getData: () => T | undefined;
  readonly setData: (data: T) => void;
  readonly isResolved: () => boolean;
  readonly trigger: () => void;
};

/** Node with async metadata */
export type AsyncFragment<TElement = unknown, T = unknown> = NodeRef<TElement> & {
  [ASYNC_FRAGMENT]: AsyncMeta<T>;
};

/** Check if a value is an async fragment */
export function isAsyncFragment(value: unknown): value is AsyncFragment {
  return typeof value === 'object' && value !== null && ASYNC_FRAGMENT in value;
}

/** Get async metadata from a node */
export function getAsyncMeta<T>(node: NodeRef<unknown>): AsyncMeta<T> | undefined {
  return (node as Partial<AsyncFragment>)[ASYNC_FRAGMENT] as AsyncMeta<T> | undefined;
}

// =============================================================================
// Load Factory
// =============================================================================

/**
 * Load factory type - creates async boundaries with fetcher/renderer pattern
 *
 * The renderer receives a state object with reactive properties:
 * - status: Reactive<'pending' | 'ready' | 'error'>
 * - data: Reactive<T | undefined>
 * - error: Reactive<unknown | undefined>
 *
 * User controls how to render based on state - typically using match() on state.status.
 *
 * @example
 * ```ts
 * load(
 *   () => fetch('/api/data').then(r => r.json()),
 *   (state) => match(state.status, (status) => {
 *     switch (status) {
 *       case 'pending': return el('div')('Loading...');
 *       case 'error': return el('div')(`Error: ${state.error()}`);
 *       case 'ready': return DataView(state.data()!);
 *     }
 *   })
 * )
 * ```
 */
export type LoadFactory = <T, TElement>(
  fetcher: () => Promise<T>,
  renderer: (state: LoadState<T>) => RefSpec<TElement>
) => RefSpec<TElement>;

/**
 * Options for createLoadFactory
 */
export type LoadOpts = {
  signal: SignalFactory;
};

/**
 * Create a load factory with the given dependencies.
 *
 * @example
 * ```ts
 * import { createLoadFactory } from '@lattice/view/load';
 *
 * const load = createLoadFactory({ signal });
 *
 * const asyncContent = load(
 *   () => fetchData(),
 *   (state) => match(state.status, (status) =>
 *     status === 'ready' ? Content(state.data()!) : Loading()
 *   )
 * );
 * ```
 */
export function createLoadFactory({ signal }: LoadOpts): LoadFactory {
  function load<T, TElement>(
    fetcher: () => Promise<T>,
    renderer: (state: LoadState<T>) => RefSpec<TElement>
  ): RefSpec<TElement> {
    // Create reactive state properties
    const status = signal<LoadStatus>('pending');
    const data = signal<T | undefined>(undefined);
    const error = signal<unknown | undefined>(undefined);

    const state: LoadState<T> = { status, data, error };

    // Closure state for SSR
    let resolvedData: T | undefined;
    let resolved = false;

    // Call renderer once with the state object
    // User controls reactivity via match(), when(), etc.
    const innerSpec = renderer(state);

    const meta: AsyncMeta<T> = {
      resolve: async () => {
        if (resolved && resolvedData !== undefined) {
          return resolvedData;
        }
        try {
          const result = await fetcher();
          resolvedData = result;
          resolved = true;
          // Update signals so reactive content updates
          data(result);
          status('ready');
          return result;
        } catch (err) {
          resolved = true;
          error(err);
          status('error');
          throw err;
        }
      },
      getData: () => resolvedData,
      setData: (d: T) => {
        resolvedData = d;
        resolved = true;
        data(d);
        status('ready');
      },
      isResolved: () => resolved,
      trigger: () => {
        if (resolved) return;
        fetcher().then(
          (result) => {
            resolvedData = result;
            resolved = true;
            data(result);
            status('ready');
          },
          (err) => {
            resolved = true;
            error(err);
            status('error');
          }
        );
      },
    };

    // Wrap the user's RefSpec to attach async metadata
    const refSpec = (() => refSpec) as unknown as RefSpec<TElement>;
    refSpec.status = STATUS_REF_SPEC;
    refSpec.create = <TExt>(svc?: unknown, extensions?: TExt) => {
      const nodeRef = innerSpec.create(svc, extensions);
      (nodeRef as AsyncFragment<TElement, T>)[ASYNC_FRAGMENT] = meta;

      // If already resolved (e.g., from hydration data), update signals
      if (resolved && resolvedData !== undefined) {
        data(resolvedData);
        status('ready');
      }

      return nodeRef;
    };

    return refSpec;
  }

  return load;
}

// =============================================================================
// Module Definition
// =============================================================================

/**
 * Load module - provides the load() factory for async data boundaries.
 *
 * @example
 * ```ts
 * import { compose } from '@lattice/lattice';
 * import { LoadModule } from '@lattice/view/load';
 *
 * const { load, signal } = compose(LoadModule);
 * ```
 */
export const LoadModule: Module<'load', LoadFactory, { signal: SignalFactory }> =
  defineModule({
    name: 'load',
    dependencies: [SignalModule, ScopesModule],
    create: ({ signal }: { signal: SignalFactory }) => createLoadFactory({ signal }),
  });

// =============================================================================
// Loader API - Explicit data management for SSR
// =============================================================================

/**
 * Load function with explicit ID for data lookup
 */
export type LoadFn = <T, TElement>(
  id: string,
  fetcher: () => Promise<T>,
  renderer: (state: LoadState<T>) => RefSpec<TElement>
) => RefSpec<TElement>;

/**
 * Loader instance returned by createLoader
 */
export type Loader = {
  /** Load function that takes an ID for data lookup */
  load: LoadFn;
  /** Get all collected data (for serialization after SSR) */
  getData: () => Record<string, unknown>;
  /** Push data to a load() boundary by ID. Used for SSR streaming. */
  setData: (id: string, data: unknown) => void;
  /** Check if a load() boundary with this ID exists */
  has: (id: string) => boolean;
};

/**
 * Options for creating a loader module
 */
export type LoaderOpts = {
  signal: SignalFactory;
  initialData?: Record<string, unknown>;
  /** Called when a load() boundary resolves. Useful for SSR streaming. */
  onResolve?: (id: string, data: unknown) => void;
};

/**
 * Create a loader for managing async data boundaries.
 *
 * On the server:
 * - Create loader without initial data
 * - Use load() with IDs to create async boundaries
 * - After render, call getData() to get all resolved data
 * - Serialize data to a script tag in your HTML
 *
 * On the client:
 * - Create loader with initial data from the script tag
 * - Same load() calls will use cached data instead of fetching
 *
 * @example Basic usage
 * ```ts
 * // Server
 * const loader = createLoader({ signal });
 * const { load } = loader;
 *
 * const App = () => load('stats', () => fetchStats(), (state) =>
 *   match(state.status, (s) => s === 'ready' ? Stats(state.data()!) : Loading())
 * );
 *
 * // After render
 * const data = loader.getData();
 * // Add to HTML: <script>window.__DATA__ = ${JSON.stringify(data)}</script>
 *
 * // Client
 * const loader = createLoader({ signal, initialData: window.__DATA__ });
 * const { load } = loader;
 * // Same App component - uses cached data, no re-fetch
 * ```
 *
 * @example SSR streaming
 * ```ts
 * const loader = createLoader({
 *   signal,
 *   onResolve: (id, data) => {
 *     // Stream chunk to client as each boundary resolves
 *     const html = renderFragment(id);
 *     stream.write(`<script>__LATTICE_HYDRATE__("${id}", ${JSON.stringify(html)})</script>`);
 *   }
 * });
 * ```
 */
export function createLoader(opts: LoaderOpts): Loader {
  const { signal, initialData, onResolve } = opts;

  // Collected data from resolved async boundaries (for getData())
  const collectedData: Record<string, unknown> = {};

  // Registry of active load() boundaries by ID for streaming
  const boundarySetters = new Map<string, (data: unknown) => void>();

  function load<T, TElement>(
    id: string,
    fetcher: () => Promise<T>,
    renderer: (state: LoadState<T>) => RefSpec<TElement>
  ): RefSpec<TElement> {
    // Create reactive state properties
    const status = signal<LoadStatus>('pending');
    const data = signal<T | undefined>(undefined);
    const error = signal<unknown | undefined>(undefined);

    const state: LoadState<T> = { status, data, error };

    // Check if we have initial data for this ID (consume once, then delete)
    const hasInitialData = initialData !== undefined && id in initialData;
    let resolvedData: T | undefined = hasInitialData
      ? (initialData[id] as T)
      : undefined;
    let resolved = hasInitialData;

    // Delete after consuming so subsequent mounts will re-fetch
    if (hasInitialData) {
      delete initialData[id];
    }

    // If we have initial data, set signals immediately
    if (hasInitialData && resolvedData !== undefined) {
      data(resolvedData);
      status('ready');
    }

    // Call renderer once with the state object
    const innerSpec = renderer(state);

    // Shared setData implementation for both meta and registry
    const setDataImpl = (d: T): void => {
      resolvedData = d;
      resolved = true;
      collectedData[id] = d;
      data(d);
      status('ready');
      onResolve?.(id, d);
    };

    // Register in boundary registry for streaming
    boundarySetters.set(id, setDataImpl as (data: unknown) => void);

    const meta: AsyncMeta<T> = {
      id,
      resolve: async () => {
        if (resolved && resolvedData !== undefined) {
          return resolvedData;
        }
        try {
          const result = await fetcher();
          resolvedData = result;
          resolved = true;
          // Store in collected data for getData()
          collectedData[id] = result;
          // Update signals so reactive content updates
          data(result);
          status('ready');
          onResolve?.(id, result);
          return result;
        } catch (err) {
          resolved = true;
          error(err);
          status('error');
          throw err;
        }
      },
      getData: () => resolvedData,
      setData: setDataImpl,
      isResolved: () => resolved,
      trigger: () => {
        if (resolved) return;
        fetcher().then(
          (result) => {
            resolvedData = result;
            resolved = true;
            collectedData[id] = result;
            data(result);
            status('ready');
            onResolve?.(id, result);
          },
          (err) => {
            resolved = true;
            error(err);
            status('error');
          }
        );
      },
    };

    // Wrap the user's RefSpec to attach async metadata
    const refSpec = (() => refSpec) as unknown as RefSpec<TElement>;
    refSpec.status = STATUS_REF_SPEC;
    refSpec.create = <TExt>(svc?: unknown, extensions?: TExt) => {
      const nodeRef = innerSpec.create(svc, extensions);
      (nodeRef as AsyncFragment<TElement, T>)[ASYNC_FRAGMENT] = meta;

      // If already resolved (from initial data), ensure signals are set
      if (resolved && resolvedData !== undefined) {
        data(resolvedData);
        status('ready');
      }

      return nodeRef;
    };

    return refSpec;
  }

  return {
    load,
    getData: () => ({ ...collectedData }),
    setData: (id: string, data: unknown) => {
      const setter = boundarySetters.get(id);
      if (setter) {
        setter(data);
      }
    },
    has: (id: string) => boundarySetters.has(id),
  };
}

/**
 * Create a Loader module for use with compose().
 *
 * Like createElModule(adapter), this takes configuration at module creation time
 * and returns a Module that can be composed with other modules.
 *
 * @param opts - Loader options (initialData for hydration, onResolve for streaming)
 *
 * @example
 * ```typescript
 * import { compose, merge } from '@lattice/lattice';
 * import { SignalModule, ComputedModule } from '@lattice/signals/extend';
 * import { createLoaderModule } from '@lattice/view/load';
 * import { createRouterModule } from '@lattice/router';
 *
 * const baseSvc = compose(SignalModule, ComputedModule, ElModule);
 *
 * const svc = merge(
 *   baseSvc,
 *   compose(
 *     createLoaderModule({ initialData: window.__DATA__ }),
 *     createRouterModule(routes, { initialPath: '/' })
 *   )
 * );
 *
 * // Loader is now part of the composed context
 * const { loader } = svc;
 * loader.load('my-data', () => fetchData(), (state) => ...);
 * ```
 */
export const createLoaderModule = (
  opts: Omit<LoaderOpts, 'signal'> = {}
): Module<'loader', Loader, { signal: SignalFactory }> =>
  defineModule({
    name: 'loader',
    dependencies: [SignalModule],
    create: ({ signal }: { signal: SignalFactory }) =>
      createLoader({ signal, ...opts }),
  });
