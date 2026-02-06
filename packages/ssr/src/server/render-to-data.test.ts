/**
 * Tests for renderToData
 */

import { describe, it, expect } from 'vitest';
import { renderToData } from './render-to-data';
import { createLoader } from '@rimitive/view/load';
import type { LoadState } from '@rimitive/view/load';
import { STATUS_REF_SPEC, STATUS_FRAGMENT } from '@rimitive/view/types';
import type { RefSpec, FragmentRef } from '@rimitive/view/types';
import { ASYNC_FRAGMENT } from '@rimitive/view/load';
import type { AsyncMeta } from '@rimitive/view/load';
import {
  createMockRefSpec,
  createServerTestEnv,
  mockMount,
} from './test-fixtures';

describe('renderToData', () => {
  it('should return empty object when no load boundaries exist', async () => {
    const spec = createMockRefSpec('<div>Static content</div>');
    const getData = () => ({});

    const data = await renderToData(spec, {
      mount: mockMount,
      getData,
    });

    expect(data).toEqual({});
  });

  it('should return data from resolved load boundaries', async () => {
    const { signal } = createServerTestEnv();
    const loader = createLoader({ signal });

    const App = loader.load(
      'user-data',
      () => Promise.resolve({ name: 'Alice', age: 30 }),
      (state: LoadState<{ name: string; age: number }>) => {
        if (state.status() === 'ready')
          return createMockRefSpec(`<div>${state.data()?.name}</div>`);
        return createMockRefSpec('<div>Loading...</div>');
      }
    );

    const data = await renderToData(App, {
      mount: mockMount,
      getData: () => loader.getData(),
    });

    expect(data).toEqual({ 'user-data': { name: 'Alice', age: 30 } });
  });

  it('should return data from nested boundaries (load inside load)', async () => {
    // Simulates nested load boundaries using the manual fragment approach
    // Outer boundary resolves and reveals inner boundary in the tree

    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((r) => { resolve = r; });
      return { promise, resolve };
    }

    const outerDeferred = deferred<string>();
    const innerDeferred = deferred<string>();

    const collectedData: Record<string, unknown> = {};

    const innerFragment: FragmentRef<unknown> & { [ASYNC_FRAGMENT]: AsyncMeta<string> } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: {
        id: 'inner-data',
        resolve: () => innerDeferred.promise.then((val) => {
          collectedData['inner-data'] = val;
          return val;
        }),
        getData: () => collectedData['inner-data'] as string | undefined,
        setData: () => {},
        isResolved: () => false,
        trigger: () => {},
      } satisfies AsyncMeta<string>,
      attach() {},
    };

    const outerFragment: FragmentRef<unknown> & { [ASYNC_FRAGMENT]: AsyncMeta<string> } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: {
        id: 'outer-data',
        resolve: () => outerDeferred.promise.then((val) => {
          collectedData['outer-data'] = val;
          // Reveal inner fragment when outer resolves
          outerFragment.firstChild = innerFragment;
          outerFragment.lastChild = innerFragment;
          return val;
        }),
        getData: () => collectedData['outer-data'] as string | undefined,
        setData: () => {},
        isResolved: () => false,
        trigger: () => {},
      } satisfies AsyncMeta<string>,
      attach() {},
    };

    const rootSpec: RefSpec<unknown> = {
      status: STATUS_REF_SPEC,
      create: () => outerFragment,
    };

    // Resolve both immediately (simulate fast data)
    outerDeferred.resolve('outer-content');
    innerDeferred.resolve('inner-content');

    const data = await renderToData(rootSpec, {
      mount: mockMount,
      getData: () => collectedData,
    });

    expect(data).toEqual({
      'outer-data': 'outer-content',
      'inner-data': 'inner-content',
    });
  });

  it('should return data from boundaries behind lazy()', async () => {
    // Simulates: lazy(() => import('./Page')) revealing a load() boundary

    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((r) => { resolve = r; });
      return { promise, resolve };
    }

    const lazyDeferred = deferred<string>();
    const loadDeferred = deferred<unknown>();

    const collectedData: Record<string, unknown> = {};

    const loadFragment: FragmentRef<unknown> & { [ASYNC_FRAGMENT]: AsyncMeta<unknown> } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: {
        id: 'page-content',
        resolve: () => loadDeferred.promise.then((val) => {
          collectedData['page-content'] = val;
          return val;
        }),
        getData: () => collectedData['page-content'],
        setData: () => {},
        isResolved: () => false,
        trigger: () => {},
      } satisfies AsyncMeta<unknown>,
      attach() {},
    };

    const lazyFragment: FragmentRef<unknown> & { [ASYNC_FRAGMENT]: AsyncMeta<string> } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: {
        id: 'lazy-chunk',
        resolve: () => lazyDeferred.promise.then((val) => {
          // Lazy resolution reveals the load boundary
          lazyFragment.firstChild = loadFragment;
          lazyFragment.lastChild = loadFragment;
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

    // Resolve lazy chunk immediately, then load data
    lazyDeferred.resolve('chunk-loaded');
    loadDeferred.resolve({ title: 'Dashboard', stats: [1, 2, 3] });

    const data = await renderToData(rootSpec, {
      mount: mockMount,
      getData: () => collectedData,
    });

    expect(data).toEqual({
      'page-content': { title: 'Dashboard', stats: [1, 2, 3] },
    });
  });
});
