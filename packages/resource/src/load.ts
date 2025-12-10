/**
 * Async data loading boundaries
 *
 * load() creates async boundaries with a fetcher/renderer pattern.
 * Internally uses match() for reactive content swapping.
 * SSR introspection via Symbol-keyed metadata.
 */

import type { RefSpec, FragmentRef, NodeRef } from '@lattice/view/types';
import { STATUS_FRAGMENT, STATUS_ELEMENT } from '@lattice/view/types';
import type { Adapter, AdapterConfig } from '@lattice/view/adapter';
import type { CreateScopes } from '@lattice/view/deps/scope';
import { ScopesModule } from '@lattice/view/deps/scope';
import { createMatchFactory } from '@lattice/view/match';
import { defineModule, type Module } from '@lattice/lattice';
import { SignalModule, type SignalFactory } from '@lattice/signals/signal';
import type { LoadState } from './types';

// =============================================================================
// Public API
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

export type LoadFactory<TBaseElement> = <T, TElement extends TBaseElement>(
  fetcher: () => Promise<T>,
  renderer: (state: LoadState<T>) => RefSpec<TElement>,
  options?: LoadOptions
) => RefSpec<TElement>;

export type LoadFactoryOpts<TConfig extends AdapterConfig> = {
  signal: SignalFactory;
  disposeScope: CreateScopes['disposeScope'];
  scopedEffect: CreateScopes['scopedEffect'];
  getElementScope: CreateScopes['getElementScope'];
  adapter: Adapter<TConfig>;
};

let idCounter = 0;

export function createLoadFactory<TConfig extends AdapterConfig>({
  signal,
  adapter,
  disposeScope,
  scopedEffect,
  getElementScope,
}: LoadFactoryOpts<TConfig>): LoadFactory<TConfig['baseElement']> {
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
// SSR Helpers
// =============================================================================

export async function resolveAsyncFragment<TElement>(
  fragment: AsyncFragment<TElement>
): Promise<RefSpec<TElement>> {
  const { refSpec } = await fragment[ASYNC_FRAGMENT].resolve();
  return refSpec as RefSpec<TElement>;
}

export function collectAsyncFragments<TElement>(
  nodeRef: NodeRef<TElement>
): AsyncFragment<TElement>[] {
  const fragments: AsyncFragment<TElement>[] = [];

  function walk(node: NodeRef<TElement> | null): void {
    if (!node) return;
    if (isAsyncFragment(node)) fragments.push(node as AsyncFragment<TElement>);
    if (node.status === STATUS_FRAGMENT || node.status === STATUS_ELEMENT) {
      let child = node.firstChild;
      while (child) {
        walk(child);
        child = child.next;
      }
    }
  }

  walk(nodeRef);
  return fragments;
}

export function triggerAsyncFragment<TElement>(fragment: AsyncFragment<TElement>): void {
  fragment[ASYNC_FRAGMENT].trigger();
}

export function triggerAsyncFragments<TElement>(nodeRef: NodeRef<TElement>): void {
  for (const fragment of collectAsyncFragments(nodeRef)) {
    triggerAsyncFragment(fragment);
  }
}

// =============================================================================
// Module Definition
// =============================================================================

export const LoadModule = defineModule({
  name: 'load',
  dependencies: [SignalModule, ScopesModule],
  create: <TConfig extends AdapterConfig>({
    signal,
    scopes,
    adapter,
  }: {
    signal: SignalFactory;
    scopes: CreateScopes;
    adapter: Adapter<TConfig>;
  }): LoadFactory<TConfig['baseElement']> =>
    createLoadFactory({ signal, adapter, ...scopes }),
});

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
