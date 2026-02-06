/**
 * Tests for renderToStream — lazy + load discovery
 */

import { describe, it, expect } from 'vitest';
import { renderToStream } from './render-to-stream';
import { STATUS_REF_SPEC, STATUS_FRAGMENT } from '@rimitive/view/types';
import type { RefSpec, FragmentRef } from '@rimitive/view/types';
import { ASYNC_FRAGMENT } from '@rimitive/view/load';
import type { AsyncMeta } from '@rimitive/view/load';
import {
  serialize,
  mockMount,
  mockInsertFragmentMarkers,
} from './test-fixtures';

describe('renderToStream - lazy + load discovery', () => {
  it('should discover and resolve load() behind a lazy boundary via pipelined resolution', async () => {
    // Simulates: lazy(() => import('./Page')) where the page contains load() boundaries
    //
    // The outer fragment represents the lazy boundary.
    // When it resolves, it reveals an inner async fragment (the load() boundary).
    // The pipelined resolver should discover and resolve the inner fragment.

    const resolvedIds: string[] = [];

    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((r) => { resolve = r; });
      return { promise, resolve };
    }

    const lazyChunkDeferred = deferred<string>();
    const loadDataDeferred = deferred<string>();

    // The load() boundary — hidden until lazy chunk arrives
    const loadFragment: FragmentRef<unknown> & { [ASYNC_FRAGMENT]: AsyncMeta<string> } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: {
        id: 'page-data',
        resolve: () => loadDataDeferred.promise.then((val) => {
          resolvedIds.push('page-data');
          return val;
        }),
        getData: () => undefined,
        setData: () => {},
        isResolved: () => false,
        trigger: () => {},
      } satisfies AsyncMeta<string>,
      attach() {},
    };

    // The lazy boundary — when it resolves, it reveals the load fragment
    const lazyFragment: FragmentRef<unknown> & { [ASYNC_FRAGMENT]: AsyncMeta<string> } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: {
        id: 'lazy-page',
        resolve: () => lazyChunkDeferred.promise.then((val) => {
          resolvedIds.push('lazy-page');
          return val;
        }),
        getData: () => undefined,
        setData: () => {},
        isResolved: () => false,
        trigger: () => {},
      } satisfies AsyncMeta<string>,
      attach() {},
    };

    const rootSpec: RefSpec<unknown> = {
      status: STATUS_REF_SPEC,
      create: () => lazyFragment,
    };

    const result = renderToStream(rootSpec, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    expect(result.pendingCount).toBe(1); // Only lazy fragment is visible initially

    // Step 1: Resolve the lazy chunk — this reveals the load fragment
    lazyFragment.firstChild = loadFragment;
    lazyFragment.lastChild = loadFragment;
    lazyChunkDeferred.resolve('chunk-loaded');

    // Allow microtasks for lazy resolution + tree re-collection
    await Promise.resolve();
    await Promise.resolve();

    // Step 2: Resolve the load data
    loadDataDeferred.resolve('page-content');

    await result.done;

    // Both fragments should have resolved in order: lazy first, then load
    expect(resolvedIds).toEqual(['lazy-page', 'page-data']);
  });

  it('should discover multiple load() boundaries behind a single lazy boundary', async () => {
    const resolvedIds: string[] = [];

    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((r) => { resolve = r; });
      return { promise, resolve };
    }

    const lazyDeferred = deferred<string>();
    const loadADeferred = deferred<string>();
    const loadBDeferred = deferred<string>();

    // Two load() boundaries behind the lazy chunk
    const loadA: FragmentRef<unknown> & { [ASYNC_FRAGMENT]: AsyncMeta<string> } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: {
        id: 'data-a',
        resolve: () => loadADeferred.promise.then((val) => { resolvedIds.push('data-a'); return val; }),
        getData: () => undefined,
        setData: () => {},
        isResolved: () => false,
        trigger: () => {},
      } satisfies AsyncMeta<string>,
      attach() {},
    };

    const loadB: FragmentRef<unknown> & { [ASYNC_FRAGMENT]: AsyncMeta<string> } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: {
        id: 'data-b',
        resolve: () => loadBDeferred.promise.then((val) => { resolvedIds.push('data-b'); return val; }),
        getData: () => undefined,
        setData: () => {},
        isResolved: () => false,
        trigger: () => {},
      } satisfies AsyncMeta<string>,
      attach() {},
    };

    // Link the two load fragments as siblings
    loadA.next = loadB;

    const lazyFragment: FragmentRef<unknown> & { [ASYNC_FRAGMENT]: AsyncMeta<string> } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: {
        id: 'lazy-dashboard',
        resolve: () => lazyDeferred.promise.then((val) => { resolvedIds.push('lazy-dashboard'); return val; }),
        getData: () => undefined,
        setData: () => {},
        isResolved: () => false,
        trigger: () => {},
      } satisfies AsyncMeta<string>,
      attach() {},
    };

    const rootSpec: RefSpec<unknown> = {
      status: STATUS_REF_SPEC,
      create: () => lazyFragment,
    };

    const result = renderToStream(rootSpec, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    expect(result.pendingCount).toBe(1);

    // Resolve lazy — reveals both load boundaries
    lazyFragment.firstChild = loadA;
    lazyFragment.lastChild = loadB;
    lazyDeferred.resolve('chunk');

    await Promise.resolve();
    await Promise.resolve();

    // Resolve both load boundaries in parallel
    loadADeferred.resolve('content-a');
    loadBDeferred.resolve('content-b');

    await result.done;

    // Lazy resolved first, then both load boundaries (order between A and B may vary)
    expect(resolvedIds[0]).toBe('lazy-dashboard');
    expect(resolvedIds).toContain('data-a');
    expect(resolvedIds).toContain('data-b');
    expect(resolvedIds).toHaveLength(3);
  });
});
