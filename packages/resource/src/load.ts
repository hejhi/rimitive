/**
 * Async data loading boundaries
 *
 * load() creates async boundaries with a fetcher/renderer pattern:
 * - fetcher: () => Promise<T> - async function to fetch data
 * - renderer: (state: LoadState<T>) => RefSpec - renders based on state
 *
 * load() is completely passive - it doesn't know about SSR, hydration, or environments.
 * The adapter controls when/how data is fetched:
 * - DOM adapter: calls run() on attach → shows pending, then ready/error
 * - SSR: calls run() during traversal, awaits, renders ready state
 * - Hydration: calls setData() before attach → renders ready state immediately
 */

import type { RefSpec, FragmentRef, NodeRef } from '@lattice/view/types';
import {
  STATUS_REF_SPEC,
  STATUS_FRAGMENT,
  STATUS_ELEMENT,
} from '@lattice/view/types';
import type { Adapter, AdapterConfig } from '@lattice/view/adapter';
import type { CreateScopes } from '@lattice/view/deps/scope';
import { ScopesModule } from '@lattice/view/deps/scope';
import { createNodeHelpers } from '@lattice/view/deps/node-deps';
import { setFragmentChild } from '@lattice/view/deps/fragment-boundaries';
import { defineModule, type Module } from '@lattice/lattice';
import type { LoadState } from './types';

/**
 * Options for load()
 */
export type LoadOptions = {
  /**
   * Unique ID for hydration data matching.
   * If not provided, one will be generated.
   */
  id?: string;
};

/**
 * Load factory type - creates async boundaries with fetcher/renderer pattern
 */
export interface LoadFactory<TBaseElement> {
  <T, TElement extends TBaseElement>(
    fetcher: () => Promise<T>,
    renderer: (state: LoadState<T>) => RefSpec<TElement>,
    options?: LoadOptions
  ): RefSpec<TElement>;
}

/**
 * Options for createLoadFactory
 */
export type LoadFactoryOpts<TConfig extends AdapterConfig> = {
  scopedEffect: CreateScopes['scopedEffect'];
  disposeScope: CreateScopes['disposeScope'];
  getElementScope: CreateScopes['getElementScope'];
  adapter: Adapter<TConfig>;
};

/**
 * Async fragment metadata - stored on fragments created by load()
 */
export type AsyncFragmentMeta<T> = {
  /** Marker to identify this as an async fragment */
  __async: true;
  /** Unique ID for hydration data matching */
  __id: string;
  /** The fetcher function */
  __fetcher: () => Promise<T>;
  /** The renderer function */
  __renderer: (state: LoadState<T>) => RefSpec<unknown>;
  /** Cached data after fetch completes (for SSR serialization) */
  __hydrationData?: T;
  /** Whether this fragment has been resolved */
  __resolved?: boolean;

  /**
   * Run the fetcher and return the data.
   * Call this to trigger the async operation.
   * Returns cached data if already resolved.
   */
  run: () => Promise<T>;

  /**
   * Inject pre-fetched data (for hydration).
   * Call this before attach to skip fetching.
   */
  setData: (data: T) => void;

  /**
   * Swap the rendered content based on state.
   * Called internally after run() completes or setData() is called.
   * Can also be called externally by adapter if needed.
   */
  __swapContent?: (state: LoadState<T>) => void;
};

/**
 * Async fragment ref - FragmentRef with async metadata
 */
export type AsyncFragmentRef<TElement> = FragmentRef<TElement> &
  AsyncFragmentMeta<unknown>;

// Counter for generating unique IDs
let loadIdCounter = 0;

/**
 * Create a load factory with the given options.
 *
 * The load factory creates async boundaries for data loading with a clean
 * fetcher/renderer pattern that mirrors the match() API style.
 *
 * @example
 * ```ts
 * const Stats = (svc: Service) => () => {
 *   const { el, load } = svc;
 *
 *   return load(
 *     () => fetchStats(),
 *     (state) => {
 *       switch (state.status) {
 *         case 'pending':
 *           return el('div')('Loading stats...');
 *         case 'error':
 *           return el('div')(`Error: ${state.error}`);
 *         case 'ready':
 *           return StatsContent(svc, state.data);
 *       }
 *     },
 *     { id: 'stats-page' }
 *   );
 * };
 * ```
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
    const id = options?.id ?? `load-${++loadIdCounter}`;

    // Pending fetch promise (to avoid duplicate fetches)
    let pendingFetch: Promise<T> | undefined;

    // Create RefSpec that produces a fragment with async behavior
    const refSpec = (() => refSpec) as unknown as RefSpec<TElement>;

    refSpec.status = STATUS_REF_SPEC;
    refSpec.create = (svc) => {
      // Mutable state for the fragment
      let hydrationData: T | undefined;
      let resolved = false;
      let swapContentFn: ((state: LoadState<T>) => void) | undefined;

      const fragment: AsyncFragmentRef<TBaseElement> = {
        // FragmentRef properties
        status: STATUS_FRAGMENT,
        element: null,
        parent: null,
        prev: null,
        next: null,
        firstChild: null,
        lastChild: null,

        // Async metadata
        __async: true,
        __id: id,
        __fetcher: fetcher,
        __renderer: renderer as (state: LoadState<unknown>) => RefSpec<unknown>,

        get __hydrationData() {
          return hydrationData;
        },
        get __resolved() {
          return resolved;
        },
        get __swapContent() {
          return swapContentFn as
            | ((state: LoadState<unknown>) => void)
            | undefined;
        },

        // Run the fetcher - returns promise with data
        run: async (): Promise<unknown> => {
          // Return cached data if already resolved
          if (resolved && hydrationData !== undefined) {
            return hydrationData;
          }

          // Reuse pending fetch if already started
          if (pendingFetch) {
            return pendingFetch;
          }

          // Start fetch
          pendingFetch = fetcher();

          try {
            const data = await pendingFetch;
            hydrationData = data;
            resolved = true;
            return data;
          } finally {
            pendingFetch = undefined;
          }
        },

        // Inject pre-fetched data
        setData: (data: unknown): void => {
          hydrationData = data as T;
          resolved = true;
        },

        // Attach handler - sets up content swapping
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

            // Get RefSpec from renderer
            const newSpec = renderer(state);

            // Create the element/fragment from the spec
            const nodeRef = newSpec.create(svc) as NodeRef<TBaseElement>;
            setFragmentChild(
              fragment as unknown as FragmentRef<TBaseElement>,
              nodeRef
            );
            currentNode = nodeRef;

            // Insert into DOM
            if (parent.element) {
              insertNodeBefore(
                svc,
                parent.element,
                nodeRef,
                undefined,
                nextSibling
              );
            }
          };

          // Store swapContent for external use
          swapContentFn = swapContent;

          // If data was pre-set (hydration), render ready state immediately
          if (resolved && hydrationData !== undefined) {
            swapContent({ status: 'ready', data: hydrationData });
            return;
          }

          // Otherwise, render pending state and wait for adapter to call run()
          swapContent({ status: 'pending' });
        },
      };

      return fragment as unknown as FragmentRef<TElement>;
    };

    return refSpec;
  }

  return load;
}

/**
 * Load module - provides async data loading boundaries.
 *
 * @example
 * ```ts
 * import { compose } from '@lattice/lattice';
 * import { LoadModule } from '@lattice/resource';
 *
 * const { load } = compose(LoadModule)();
 * ```
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
    createLoadFactory({
      adapter,
      ...scopes,
    }),
});

/**
 * Create a Load module for a given adapter.
 *
 * @example
 * ```ts
 * import { compose } from '@lattice/lattice';
 * import { createLoadModule } from '@lattice/resource';
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
  { scopes: CreateScopes }
> =>
  defineModule({
    name: 'load',
    dependencies: [ScopesModule],
    create: ({ scopes }: { scopes: CreateScopes }) =>
      createLoadFactory({
        adapter,
        ...scopes,
      }),
  });

/**
 * Check if a value is an async fragment (created by load())
 */
export function isAsyncFragment(
  value: unknown
): value is AsyncFragmentRef<unknown> {
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
 *
 * Returns a RefSpec that can be mounted to get the resolved content.
 *
 * @param fragment - The async fragment to resolve
 * @returns Promise that resolves to the ready-state RefSpec
 */
export async function resolveAsyncFragment<TElement>(
  fragment: AsyncFragmentRef<TElement>
): Promise<RefSpec<TElement>> {
  try {
    const data = await fragment.run();
    return fragment.__renderer({
      status: 'ready',
      data,
    }) as RefSpec<TElement>;
  } catch (error) {
    return fragment.__renderer({ status: 'error', error }) as RefSpec<TElement>;
  }
}

/**
 * Collect all async fragments from a node tree.
 * Walks the tree recursively to find all fragments with __async marker.
 *
 * @param nodeRef - The root node to start searching from
 * @returns Array of async fragments found in the tree
 */
export function collectAsyncFragments<TElement>(
  nodeRef: NodeRef<TElement>
): AsyncFragmentRef<TElement>[] {
  const fragments: AsyncFragmentRef<TElement>[] = [];

  function walk(node: NodeRef<TElement> | null): void {
    if (!node) return;

    // Check if this node is an async fragment
    if (isAsyncFragment(node)) {
      fragments.push(node as AsyncFragmentRef<TElement>);
    }

    // Walk children
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
 * Trigger an async fragment - runs the fetcher and swaps content when done.
 *
 * This is the primary way adapters should trigger async loading:
 * - Call this in onAttach hook for client-side loading
 * - Don't call this for SSR (use resolveAsyncFragment instead)
 * - Don't call this for hydration (use setData before attach)
 *
 * @param fragment - The async fragment to trigger
 */
export function triggerAsyncFragment<TElement>(
  fragment: AsyncFragmentRef<TElement>
): void {
  // Already resolved (data was pre-set or already fetched)
  if (fragment.__resolved) {
    return;
  }

  // Run fetcher and swap content when done
  fragment.run().then(
    (data) => {
      if (fragment.__swapContent) {
        fragment.__swapContent({ status: 'ready', data });
      }
    },
    (error) => {
      if (fragment.__swapContent) {
        fragment.__swapContent({ status: 'error', error });
      }
    }
  );
}

/**
 * Trigger all unresolved async fragments in a tree.
 * Convenience function that walks the tree and triggers each fragment.
 *
 * @param nodeRef - The root node to start from
 */
export function triggerAsyncFragments<TElement>(
  nodeRef: NodeRef<TElement>
): void {
  const fragments = collectAsyncFragments(nodeRef);
  for (const fragment of fragments) {
    triggerAsyncFragment(fragment);
  }
}
