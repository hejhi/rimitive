/**
 * Async data loading boundaries
 *
 * load() creates async boundaries with a fetcher/renderer pattern:
 * - fetcher: () => Promise<T> - async function to fetch data
 * - renderer: (state: LoadState<T>) => RefSpec - renders based on state
 *
 * The design mirrors match() - a fragment that swaps content based on state.
 * SSR support is achieved through introspectable metadata, not special methods.
 */

import type { RefSpec, FragmentRef, NodeRef } from '@lattice/view/types';
import { STATUS_REF_SPEC, STATUS_FRAGMENT, STATUS_ELEMENT } from '@lattice/view/types';
import type { Adapter, AdapterConfig } from '@lattice/view/adapter';
import type { CreateScopes } from '@lattice/view/deps/scope';
import { ScopesModule } from '@lattice/view/deps/scope';
import { createNodeHelpers } from '@lattice/view/deps/node-deps';
import { setFragmentChild } from '@lattice/view/deps/fragment-boundaries';
import { defineModule, type Module } from '@lattice/lattice';
import type { LoadState } from './types';

/** Options for load() */
export type LoadOptions = {
  /** Unique ID for hydration data matching */
  id?: string;
};

/** Load factory type */
export type LoadFactory<TBaseElement> = <T, TElement extends TBaseElement>(
  fetcher: () => Promise<T>,
  renderer: (state: LoadState<T>) => RefSpec<TElement>,
  options?: LoadOptions
) => RefSpec<TElement>;

/** Options for createLoadFactory */
export type LoadFactoryOpts<TConfig extends AdapterConfig> = {
  disposeScope: CreateScopes['disposeScope'];
  getElementScope: CreateScopes['getElementScope'];
  adapter: Adapter<TConfig>;
};

/**
 * Async fragment metadata - minimal introspection for SSR.
 * This is a marker interface that SSR can use to identify and resolve async boundaries.
 */
export type AsyncFragmentMeta<T> = {
  readonly __async: true;
  readonly __id: string;
  readonly __fetcher: () => Promise<T>;
  readonly __renderer: (state: LoadState<T>) => RefSpec<unknown>;
  /** Set after resolution - SSR reads this for hydration serialization */
  __data?: T;
  /** Set after resolution - SSR checks this to know when fetch completed */
  __resolved?: boolean;
};

/** Async fragment ref - FragmentRef with async metadata */
export type AsyncFragmentRef<TElement> = FragmentRef<TElement> &
  AsyncFragmentMeta<unknown>;

// Counter for generating unique IDs
let idCounter = 0;

/**
 * Create a load factory with the given options.
 *
 * load() creates async boundaries that:
 * 1. Render pending state immediately on attach
 * 2. Fetch data asynchronously
 * 3. Swap to ready/error state when fetch completes
 *
 * The pattern mirrors match() - reactive content swapping in a fragment.
 * SSR can introspect via __async marker and resolve before rendering.
 */
export function createLoadFactory<TConfig extends AdapterConfig>({
  adapter,
  disposeScope,
  getElementScope,
}: LoadFactoryOpts<TConfig>): LoadFactory<TConfig['baseElement']> {
  type TBaseElement = TConfig['baseElement'];

  const { insertNodeBefore, removeNode } = createNodeHelpers({
    adapter,
    disposeScope,
    getElementScope,
  });

  function load<T, TElement extends TBaseElement>(
    fetcher: () => Promise<T>,
    renderer: (state: LoadState<T>) => RefSpec<TElement>,
    options?: LoadOptions
  ): RefSpec<TElement> {
    const id = options?.id ?? `load-${++idCounter}`;

    const refSpec = (() => refSpec) as unknown as RefSpec<TElement>;
    refSpec.status = STATUS_REF_SPEC;

    refSpec.create = (svc) => {
      // Mutable state for the fragment
      let data: T | undefined;
      let resolved = false;

      const fragment = {
        // FragmentRef properties
        status: STATUS_FRAGMENT,
        element: null,
        parent: null,
        prev: null,
        next: null,
        firstChild: null,
        lastChild: null,

        // Async metadata (getters expose mutable state)
        __async: true as const,
        __id: id,
        __fetcher: fetcher,
        __renderer: renderer as (state: LoadState<unknown>) => RefSpec<unknown>,
        get __data() {
          return data;
        },
        set __data(v: unknown) {
          data = v as T;
        },
        get __resolved() {
          return resolved;
        },
        set __resolved(v: boolean) {
          resolved = v;
        },

        attach(
          parent: { element: TBaseElement | null },
          nextSibling: NodeRef<TBaseElement> | null
        ) {
          let currentNode: NodeRef<TBaseElement> | undefined;

          const swapContent = (state: LoadState<T>) => {
            // Clean up old content
            if (currentNode && parent.element) {
              removeNode(parent.element, currentNode);
            }

            // Create new content from renderer
            const nodeRef = renderer(state).create(svc) as NodeRef<TBaseElement>;
            setFragmentChild(
              fragment as unknown as FragmentRef<TBaseElement>,
              nodeRef
            );
            currentNode = nodeRef;

            // Insert into DOM
            if (parent.element) {
              insertNodeBefore(svc, parent.element, nodeRef, undefined, nextSibling);
            }
          };

          // Store swapContent for external triggering (client-side adapter hooks)
          (fragment as { __swap?: typeof swapContent }).__swap = swapContent;

          // If data was pre-set (hydration or SSR resolution), render ready state
          if (resolved && data !== undefined) {
            swapContent({ status: 'ready', data });
            return;
          }

          // Render pending state - fetching is triggered externally by:
          // - SSR: resolveAsyncFragment()
          // - Client: triggerAsyncFragment() via adapter onAttach hook
          swapContent({ status: 'pending' });
        },
      } as AsyncFragmentRef<TBaseElement>;

      return fragment as unknown as FragmentRef<TElement>;
    };

    return refSpec;
  }

  return load;
}

/**
 * Load module - provides async data loading boundaries.
 */
export const LoadModule = defineModule({
  name: 'load',
  dependencies: [ScopesModule],
  create: <TConfig extends AdapterConfig>({
    scopes,
    adapter,
  }: {
    scopes: CreateScopes;
    adapter: Adapter<TConfig>;
  }): LoadFactory<TConfig['baseElement']> =>
    createLoadFactory({ adapter, ...scopes }),
});

/**
 * Create a Load module for a given adapter.
 */
export const createLoadModule = <TConfig extends AdapterConfig>(
  adapter: Adapter<TConfig>
): Module<
  'load',
  LoadFactory<TConfig['baseElement']>,
  { scopes: CreateScopes }
> =>
  defineModule({
    name: 'load',
    dependencies: [ScopesModule],
    create: ({ scopes }: { scopes: CreateScopes }) =>
      createLoadFactory({ adapter, ...scopes }),
  });

/** Check if a value is an async fragment (created by load()) */
export function isAsyncFragment(value: unknown): value is AsyncFragmentRef<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    (value as { status: number }).status === STATUS_FRAGMENT &&
    '__async' in value &&
    (value as { __async: unknown }).__async === true
  );
}

/**
 * Resolve an async fragment by calling its fetcher.
 * Used by SSR to await async boundaries before rendering.
 */
export async function resolveAsyncFragment<TElement>(
  fragment: AsyncFragmentRef<TElement>
): Promise<RefSpec<TElement>> {
  // Return cached result if already resolved
  if (fragment.__resolved && fragment.__data !== undefined) {
    return fragment.__renderer({
      status: 'ready',
      data: fragment.__data,
    }) as RefSpec<TElement>;
  }

  try {
    const data = await fragment.__fetcher();
    fragment.__data = data;
    fragment.__resolved = true;
    return fragment.__renderer({ status: 'ready', data }) as RefSpec<TElement>;
  } catch (error) {
    fragment.__resolved = true;
    return fragment.__renderer({ status: 'error', error }) as RefSpec<TElement>;
  }
}

/**
 * Collect all async fragments from a node tree.
 */
export function collectAsyncFragments<TElement>(
  nodeRef: NodeRef<TElement>
): AsyncFragmentRef<TElement>[] {
  const fragments: AsyncFragmentRef<TElement>[] = [];

  function walk(node: NodeRef<TElement> | null): void {
    if (!node) return;

    if (isAsyncFragment(node)) {
      fragments.push(node as AsyncFragmentRef<TElement>);
    }

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

/**
 * Trigger an async fragment - for client-side loading via adapter hooks.
 * If already resolved (e.g., hydration data was set), this is a no-op.
 * Must be called after attach() since it uses the swapContent function.
 */
export function triggerAsyncFragment<TElement>(
  fragment: AsyncFragmentRef<TElement>
): void {
  // Already resolved - nothing to do (attach() already rendered ready state)
  if (fragment.__resolved) return;

  // Get the swap function stored by attach()
  const swap = (fragment as { __swap?: (state: LoadState<unknown>) => void }).__swap;
  if (!swap) return; // Not attached yet

  // Start fetch and swap content when done
  fragment.__fetcher().then(
    (data) => {
      fragment.__data = data;
      fragment.__resolved = true;
      swap({ status: 'ready', data });
    },
    (error) => {
      fragment.__resolved = true;
      swap({ status: 'error', error });
    }
  );
}

/**
 * Trigger all unresolved async fragments in a tree.
 */
export function triggerAsyncFragments<TElement>(
  nodeRef: NodeRef<TElement>
): void {
  for (const fragment of collectAsyncFragments(nodeRef)) {
    triggerAsyncFragment(fragment);
  }
}
