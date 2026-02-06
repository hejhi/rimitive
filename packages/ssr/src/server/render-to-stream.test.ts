/**
 * Tests for renderToStream — core streaming SSR functionality
 */

import { describe, it, expect } from 'vitest';
import { renderToStream } from './render-to-stream';
import { createStreamWriter } from './stream';
import { createLoader } from '@rimitive/view/load';
import type { LoadState } from '@rimitive/view/load';
import { STATUS_REF_SPEC, STATUS_FRAGMENT } from '@rimitive/view/types';
import type { RefSpec, FragmentRef } from '@rimitive/view/types';
import { ASYNC_FRAGMENT } from '@rimitive/view/load';
import type { AsyncMeta } from '@rimitive/view/load';
import {
  serialize,
  createMockRefSpec,
  createServerTestEnv,
  mockMount,
  mockInsertFragmentMarkers,
} from './test-fixtures';

describe('renderToStream', () => {
  it('should return initial HTML with pending states and resolve done when data arrives', async () => {
    const { signal } = createServerTestEnv();
    const chunks: string[] = [];
    const stream = createStreamWriter('__TEST__');
    const loader = createLoader({
      signal,
      onResolve: (id, data) => chunks.push(stream.chunkCode(id, data)),
    });

    let resolveData: (() => void) | null = null;
    const dataPromise = new Promise<{ value: number }>((resolve) => {
      resolveData = () => resolve({ value: 42 });
    });

    const AsyncContent = loader.load(
      'test-1',
      () => dataPromise,
      (state: LoadState<{ value: number }>) => {
        const status = state.status();
        if (status === 'pending')
          return createMockRefSpec('<div>Loading...</div>');
        if (status === 'error') return createMockRefSpec('<div>Error</div>');
        return createMockRefSpec(`<div>${state.data()?.value}</div>`);
      }
    );

    const result = renderToStream(AsyncContent, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    // Initial HTML should have pending state
    expect(result.initialHtml).toContain('Loading...');
    expect(result.initialHtml).not.toContain('42');

    // done should not be resolved yet
    let doneResolved = false;
    result.done.then(() => {
      doneResolved = true;
    });

    await Promise.resolve();
    expect(doneResolved).toBe(false);

    // Resolve the data
    resolveData!();
    await result.done;
    expect(doneResolved).toBe(true);

    // Should have chunk with correct data
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain('__TEST__.push');
    expect(chunks[0]).toContain('test-1');
    expect(chunks[0]).toContain('42');
  });

  it('should resolve done promise when async boundaries error', async () => {
    const { signal } = createServerTestEnv();
    const loader = createLoader({ signal });

    const FailingContent = loader.load(
      'failing-1',
      async () => {
        throw new Error('Fetch failed');
      },
      (state: LoadState<unknown>) => {
        const status = state.status();
        if (status === 'pending')
          return createMockRefSpec('<div>Loading...</div>');
        if (status === 'error')
          return createMockRefSpec(`<div>Error: ${state.error()}</div>`);
        return createMockRefSpec('<div>Success</div>');
      }
    );

    const result = renderToStream(FailingContent, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    expect(result.initialHtml).toContain('Loading...');
    await expect(result.done).resolves.toBeUndefined();
  });

  it('should resolve cascading async fragments (load behind lazy boundary)', async () => {
    const resolvedIds: string[] = [];

    // Helper: create a deferred promise whose resolver is available immediately
    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((r) => {
        resolve = r;
      });
      return { promise, resolve };
    }

    // Pre-create deferred promises so resolvers are available before resolve() is called
    const outerDeferred = deferred<string>();
    const innerDeferred = deferred<string>();

    // Build the inner async fragment node.
    // It starts detached - the outer fragment will adopt it upon resolution.
    const innerMeta: AsyncMeta<string> = {
      id: 'inner-1',
      resolve: () => innerDeferred.promise,
      getData: () => undefined,
      setData: () => {},
      isResolved: () => false,
      trigger: () => {},
    };

    const innerFragment: FragmentRef<unknown> & {
      [ASYNC_FRAGMENT]: AsyncMeta<string>;
    } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: innerMeta,
      attach() {},
    };

    // Build the outer async fragment.
    // When its promise resolves, the .then() in resolveAllAsyncFragments settles,
    // and the next collectAsyncFragments pass walks the tree again.
    // We insert the inner fragment as a child BEFORE resolving so the tree walk finds it.
    const outerFragment = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      attach() {},
      [ASYNC_FRAGMENT]: {
        id: 'outer-1',
        resolve: () => outerDeferred.promise,
        getData: () => undefined,
        setData: () => {},
        isResolved: () => false,
        trigger: () => {},
      } satisfies AsyncMeta<string>,
    } as FragmentRef<unknown> & { [ASYNC_FRAGMENT]: AsyncMeta<string> };

    // Wrap in a RefSpec so renderToStream can mount it
    const rootSpec: RefSpec<unknown> = {
      status: STATUS_REF_SPEC,
      create: () => outerFragment,
    };

    const result = renderToStream(rootSpec, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    // Should have found the outer async fragment
    expect(result.pendingCount).toBe(1);

    // done should not be resolved yet
    let doneResolved = false;
    result.done.then(() => {
      doneResolved = true;
    });

    await Promise.resolve();
    expect(doneResolved).toBe(false);

    // Simulate outer load resolving: it reveals the inner fragment in the tree,
    // then the outer promise settles. This mirrors how a load() renderer
    // reactively swaps in a subtree containing a nested load() boundary.
    outerFragment.firstChild = innerFragment;
    outerFragment.lastChild = innerFragment;
    resolvedIds.push('outer-1');
    outerDeferred.resolve('outer-data');

    // Allow microtasks: outer resolve settles -> next collectAsyncFragments
    // finds the inner fragment -> calls inner resolve() which returns innerDeferred.promise
    await Promise.resolve();
    await Promise.resolve();
    expect(doneResolved).toBe(false);

    // Resolve inner
    resolvedIds.push('inner-1');
    innerDeferred.resolve('inner-data');

    // done should now resolve since both fragments are resolved
    await result.done;
    expect(doneResolved).toBe(true);

    // Both fragments resolved in order: outer first, then inner
    expect(resolvedIds).toEqual(['outer-1', 'inner-1']);
  });

  it('should pipeline resolution - start inner fragments immediately as each outer resolves', async () => {
    // Scenario: 3 async fragments
    //   A (outer, fast) - resolves quickly and reveals C
    //   B (outer, slow) - takes longer to resolve
    //   C (inner, behind A) - revealed when A resolves, fast on its own
    //
    // In the pipelined model:
    //   A resolves -> C is discovered immediately and starts resolving
    //   C resolves before B finishes
    //
    // Verification: C resolves before B (because A+C are faster than B)

    const resolveOrder: string[] = [];

    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((r) => {
        resolve = r;
      });
      return { promise, resolve };
    }

    const deferredA = deferred<string>();
    const deferredB = deferred<string>();
    const deferredC = deferred<string>();

    // Fragment C: inner, hidden behind A until A resolves
    const fragmentC: FragmentRef<unknown> & {
      [ASYNC_FRAGMENT]: AsyncMeta<string>;
    } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: {
        id: 'C',
        resolve: () =>
          deferredC.promise.then((val) => {
            resolveOrder.push('C');
            return val;
          }),
        getData: () => undefined,
        setData: () => {},
        isResolved: () => false,
        trigger: () => {},
      } satisfies AsyncMeta<string>,
      attach() {},
    };

    // Fragment A: outer, fast - will reveal C as a child when it resolves
    const fragmentA: FragmentRef<unknown> & {
      [ASYNC_FRAGMENT]: AsyncMeta<string>;
    } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: {
        id: 'A',
        resolve: () =>
          deferredA.promise.then((val) => {
            resolveOrder.push('A');
            return val;
          }),
        getData: () => undefined,
        setData: () => {},
        isResolved: () => false,
        trigger: () => {},
      } satisfies AsyncMeta<string>,
      attach() {},
    };

    // Fragment B: outer, slow - sibling of A
    const fragmentB: FragmentRef<unknown> & {
      [ASYNC_FRAGMENT]: AsyncMeta<string>;
    } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: {
        id: 'B',
        resolve: () =>
          deferredB.promise.then((val) => {
            resolveOrder.push('B');
            return val;
          }),
        getData: () => undefined,
        setData: () => {},
        isResolved: () => false,
        trigger: () => {},
      } satisfies AsyncMeta<string>,
      attach() {},
    };

    // Link A and B as siblings under a root fragment
    fragmentA.next = fragmentB;

    // Root contains A and B as children (C is NOT yet in the tree)
    const rootFragment: FragmentRef<unknown> = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: fragmentA,
      lastChild: fragmentB,
      attach() {},
    };

    const rootSpec: RefSpec<unknown> = {
      status: STATUS_REF_SPEC,
      create: () => rootFragment,
    };

    const result = renderToStream(rootSpec, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    // Should have found A and B initially
    expect(result.pendingCount).toBe(2);

    // Step 1: Resolve A quickly. This also inserts C as A's child.
    fragmentA.firstChild = fragmentC;
    fragmentA.lastChild = fragmentC;
    deferredA.resolve('data-A');

    // Allow microtasks: A resolves -> pipeline re-collects tree -> finds C -> starts C
    await Promise.resolve();
    await Promise.resolve();

    // Step 2: Resolve C immediately (it's fast)
    deferredC.resolve('data-C');

    // Allow microtasks for C to resolve
    await Promise.resolve();
    await Promise.resolve();

    // Step 3: Finally resolve B (the slow one)
    deferredB.resolve('data-B');

    // Wait for everything to finish
    await result.done;

    // In the pipelined model, C starts as soon as A resolves (not waiting for B).
    // So the order should be A, C, B — NOT A, B, C.
    expect(resolveOrder).toEqual(['A', 'C', 'B']);
  });
});
