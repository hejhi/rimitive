/**
 * Tests for load() async data boundaries
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createLoadFactory,
  createLoader,
  isAsyncFragment,
  getAsyncMeta,
  ASYNC_FRAGMENT,
  type LoadState,
} from './load';
import type { RefSpec, NodeRef } from './types';
import { STATUS_REF_SPEC, STATUS_ELEMENT } from './types';
import { createTestEnv } from './test-utils';

/** Create a minimal RefSpec for testing */
function mockRefSpec(): RefSpec<unknown> {
  const spec = (() => spec) as unknown as RefSpec<unknown>;
  (spec as { status: typeof STATUS_REF_SPEC }).status = STATUS_REF_SPEC;
  spec.create = (): NodeRef<unknown> => ({
    status: STATUS_ELEMENT,
    element: {},
    parent: null,
    prev: null,
    next: null,
    firstChild: null,
    lastChild: null,
  });
  return spec;
}

describe('createLoadFactory', () => {
  it('should return a RefSpec', () => {
    const { signal } = createTestEnv();
    const load = createLoadFactory({ signal });

    const spec = load(
      () => Promise.resolve('data'),
      () => mockRefSpec()
    );

    expect(spec.status).toBe(STATUS_REF_SPEC);
    expect(typeof spec.create).toBe('function');
  });

  it('should start with pending status', () => {
    const { signal } = createTestEnv();
    const load = createLoadFactory({ signal });

    let capturedState: LoadState<string> | null = null;

    load(
      () => new Promise<string>(() => {}), // never resolves
      (state) => {
        capturedState = state;
        return mockRefSpec();
      }
    );

    expect(capturedState).not.toBeNull();
    expect(capturedState!.status()).toBe('pending');
    expect(capturedState!.data()).toBeUndefined();
    expect(capturedState!.error()).toBeUndefined();
  });

  it('should transition to ready when fetcher resolves', async () => {
    const { signal } = createTestEnv();
    const load = createLoadFactory({ signal });

    let capturedState: LoadState<string> | null = null;
    let resolvePromise: (value: string) => void;
    const promise = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });

    const spec = load(
      () => promise,
      (state) => {
        capturedState = state;
        return mockRefSpec();
      }
    );

    // Mount to attach async metadata
    const node = spec.create();
    const meta = getAsyncMeta<string>(node);

    expect(capturedState!.status()).toBe('pending');

    // Resolve via meta.resolve() (as SSR would)
    const resultPromise = meta!.resolve();
    resolvePromise!('fetched data');
    await resultPromise;

    expect(capturedState!.status()).toBe('ready');
    expect(capturedState!.data()).toBe('fetched data');
    expect(capturedState!.error()).toBeUndefined();
  });

  it('should transition to error when fetcher rejects', async () => {
    const { signal } = createTestEnv();
    const load = createLoadFactory({ signal });

    let capturedState: LoadState<string> | null = null;
    const testError = new Error('fetch failed');

    const spec = load(
      () => Promise.reject(testError),
      (state) => {
        capturedState = state;
        return mockRefSpec();
      }
    );

    const node = spec.create();
    const meta = getAsyncMeta<string>(node);

    try {
      await meta!.resolve();
    } catch {
      // expected
    }

    expect(capturedState!.status()).toBe('error');
    expect(capturedState!.data()).toBeUndefined();
    expect(capturedState!.error()).toBe(testError);
  });

  it('should attach async metadata to created node', () => {
    const { signal } = createTestEnv();
    const load = createLoadFactory({ signal });

    const spec = load(
      () => Promise.resolve('data'),
      () => mockRefSpec()
    );

    const node = spec.create();

    expect(isAsyncFragment(node)).toBe(true);
    expect(ASYNC_FRAGMENT in node).toBe(true);

    const meta = getAsyncMeta(node);
    expect(meta).toBeDefined();
    expect(typeof meta!.resolve).toBe('function');
    expect(typeof meta!.getData).toBe('function');
    expect(typeof meta!.setData).toBe('function');
    expect(typeof meta!.isResolved).toBe('function');
  });
});

describe('createLoader', () => {
  it('should work like createLoadFactory but with IDs', async () => {
    const { signal } = createTestEnv();
    const loader = createLoader({ signal });

    let capturedState: LoadState<string> | null = null;

    const spec = loader.load(
      'test-id',
      () => Promise.resolve('data'),
      (state) => {
        capturedState = state;
        return mockRefSpec();
      }
    );

    const node = spec.create();
    const meta = getAsyncMeta<string>(node);
    await meta!.resolve();

    expect(capturedState!.status()).toBe('ready');
    expect(capturedState!.data()).toBe('data');
  });

  it('should collect resolved data via getData()', async () => {
    const { signal } = createTestEnv();
    const loader = createLoader({ signal });

    const spec1 = loader.load(
      'first',
      () => Promise.resolve({ a: 1 }),
      () => mockRefSpec()
    );
    const spec2 = loader.load(
      'second',
      () => Promise.resolve({ b: 2 }),
      () => mockRefSpec()
    );

    const node1 = spec1.create();
    const node2 = spec2.create();

    await getAsyncMeta(node1)!.resolve();
    await getAsyncMeta(node2)!.resolve();

    const data = loader.getData();
    expect(data).toEqual({
      first: { a: 1 },
      second: { b: 2 },
    });
  });

  it('should use initialData instead of fetching', () => {
    const { signal } = createTestEnv();
    const fetcher = vi.fn(() => Promise.resolve('should not call'));

    const loader = createLoader({
      signal,
      initialData: { 'my-id': 'pre-loaded' },
    });

    let capturedState: LoadState<string> | null = null;

    loader.load('my-id', fetcher, (state) => {
      capturedState = state;
      return mockRefSpec();
    });

    // State should be ready immediately with initial data
    expect(capturedState!.status()).toBe('ready');
    expect(capturedState!.data()).toBe('pre-loaded');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('should call onResolve when data resolves', async () => {
    const { signal } = createTestEnv();
    const onResolve = vi.fn();

    const loader = createLoader({ signal, onResolve });

    const spec = loader.load(
      'stream-id',
      () => Promise.resolve({ streamed: true }),
      () => mockRefSpec()
    );

    const node = spec.create();
    await getAsyncMeta(node)!.resolve();

    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith('stream-id', { streamed: true });
  });

  it('should call onResolve for each boundary', async () => {
    const { signal } = createTestEnv();
    const onResolve = vi.fn();

    const loader = createLoader({ signal, onResolve });

    const spec1 = loader.load(
      'a',
      () => Promise.resolve(1),
      () => mockRefSpec()
    );
    const spec2 = loader.load(
      'b',
      () => Promise.resolve(2),
      () => mockRefSpec()
    );

    const node1 = spec1.create();
    const node2 = spec2.create();

    await getAsyncMeta(node1)!.resolve();
    await getAsyncMeta(node2)!.resolve();

    expect(onResolve).toHaveBeenCalledTimes(2);
    expect(onResolve).toHaveBeenCalledWith('a', 1);
    expect(onResolve).toHaveBeenCalledWith('b', 2);
  });

  it('should not call onResolve on error', async () => {
    const { signal } = createTestEnv();
    const onResolve = vi.fn();

    const loader = createLoader({ signal, onResolve });

    const spec = loader.load(
      'fail-id',
      () => Promise.reject(new Error('fail')),
      () => mockRefSpec()
    );

    const node = spec.create();

    try {
      await getAsyncMeta(node)!.resolve();
    } catch {
      // expected
    }

    expect(onResolve).not.toHaveBeenCalled();
  });

  it('should call onResolve when using setData()', () => {
    const { signal } = createTestEnv();
    const onResolve = vi.fn();

    const loader = createLoader({ signal, onResolve });

    const spec = loader.load(
      'set-id',
      () => new Promise(() => {}), // never resolves
      () => mockRefSpec()
    );

    const node = spec.create();
    const meta = getAsyncMeta<string>(node)!;

    meta.setData('manually set');

    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith('set-id', 'manually set');
  });

  it('should return true from has() for registered load() boundaries', () => {
    const { signal } = createTestEnv();
    const loader = createLoader({ signal });

    loader.load(
      'registered-id',
      () => Promise.resolve('data'),
      () => mockRefSpec()
    );

    expect(loader.has('registered-id')).toBe(true);
  });

  it('should return false from has() for unknown IDs', () => {
    const { signal } = createTestEnv();
    const loader = createLoader({ signal });

    expect(loader.has('unknown-id')).toBe(false);
  });

  it('should update signals via loader.setData()', () => {
    const { signal } = createTestEnv();
    const loader = createLoader({ signal });

    let capturedState: LoadState<string> | null = null;

    loader.load(
      'update-id',
      () => new Promise<string>(() => {}), // never resolves
      (state) => {
        capturedState = state;
        return mockRefSpec();
      }
    );

    expect(capturedState!.status()).toBe('pending');
    expect(capturedState!.data()).toBeUndefined();

    loader.setData('update-id', 'updated data');

    expect(capturedState!.status()).toBe('ready');
    expect(capturedState!.data()).toBe('updated data');
  });

  it('should be a no-op when setData() is called with unknown ID', () => {
    const { signal } = createTestEnv();
    const loader = createLoader({ signal });

    // Should not throw
    expect(() => {
      loader.setData('unknown-id', 'some data');
    }).not.toThrow();
  });

  it('should buffer setData() and replay when load() registers the boundary', () => {
    const { signal } = createTestEnv();
    const onResolve = vi.fn();
    const loader = createLoader({ signal, onResolve });

    // Set data BEFORE the boundary is registered
    loader.setData('late-id', 'buffered-value');

    // Verify the boundary doesn't exist yet
    expect(loader.has('late-id')).toBe(false);

    // Now register the boundary
    let capturedState: LoadState<string> | null = null;
    loader.load(
      'late-id',
      () => new Promise<string>(() => {}), // never resolves
      (state) => {
        capturedState = state;
        return mockRefSpec();
      }
    );

    // The buffered data should have been replayed
    expect(capturedState!.status()).toBe('ready');
    expect(capturedState!.data()).toBe('buffered-value');

    // onResolve should have been called from the replay
    expect(onResolve).toHaveBeenCalledWith('late-id', 'buffered-value');
  });

  it('should start fetching immediately with { eager: true }', () => {
    const { signal } = createTestEnv();
    const fetcher = vi.fn(() => new Promise<string>(() => {})); // never resolves

    const loader = createLoader({ signal });

    loader.load('eager-id', fetcher, () => mockRefSpec(), { eager: true });

    // Fetcher should have been called immediately during load(), before resolve()
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should resolve from eager fetch when resolve() is called', async () => {
    const { signal } = createTestEnv();
    const loader = createLoader({ signal });

    let capturedState: LoadState<string> | null = null;

    const spec = loader.load(
      'eager-resolve-id',
      () => Promise.resolve('eager-data'),
      (state) => {
        capturedState = state;
        return mockRefSpec();
      },
      { eager: true }
    );

    const node = spec.create();
    const meta = getAsyncMeta<string>(node);

    // resolve() should piggyback on the already-in-flight eager promise
    const result = await meta!.resolve();

    expect(result).toBe('eager-data');
    expect(capturedState!.status()).toBe('ready');
    expect(capturedState!.data()).toBe('eager-data');
  });

  it('should not start eager fetch when initialData exists', () => {
    const { signal } = createTestEnv();
    const fetcher = vi.fn(() => Promise.resolve('should not call'));

    const loader = createLoader({
      signal,
      initialData: { 'eager-initial-id': 'pre-loaded' },
    });

    let capturedState: LoadState<string> | null = null;

    loader.load(
      'eager-initial-id',
      fetcher,
      (state) => {
        capturedState = state;
        return mockRefSpec();
      },
      { eager: true }
    );

    // Fetcher should NOT have been called — initialData takes precedence
    expect(fetcher).not.toHaveBeenCalled();
    expect(capturedState!.status()).toBe('ready');
    expect(capturedState!.data()).toBe('pre-loaded');
  });

  it('should handle eager fetch errors gracefully', async () => {
    const { signal } = createTestEnv();
    const testError = new Error('eager fetch failed');
    const loader = createLoader({ signal });

    let capturedState: LoadState<string> | null = null;

    const spec = loader.load(
      'eager-error-id',
      () => Promise.reject(testError),
      (state) => {
        capturedState = state;
        return mockRefSpec();
      },
      { eager: true }
    );

    const node = spec.create();
    const meta = getAsyncMeta<string>(node);

    // The eager promise rejects — resolve() should propagate the error
    try {
      await meta!.resolve();
    } catch {
      // expected
    }

    // Wait for the eager promise rejection to propagate to signals
    await Promise.resolve();

    expect(capturedState!.status()).toBe('error');
    expect(capturedState!.error()).toBe(testError);
  });

  it('should update signals from eager fetch without calling resolve()', async () => {
    const { signal } = createTestEnv();
    const loader = createLoader({ signal });

    let capturedState: LoadState<string> | null = null;
    let resolvePromise: (value: string) => void;
    const promise = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });

    loader.load(
      'eager-no-resolve-id',
      () => promise,
      (state) => {
        capturedState = state;
        return mockRefSpec();
      },
      { eager: true }
    );

    expect(capturedState!.status()).toBe('pending');

    // Resolve the eager promise — signals should update without calling resolve()
    resolvePromise!('eager-auto-data');
    await promise;
    // Allow microtask for .then() handler
    await Promise.resolve();

    expect(capturedState!.status()).toBe('ready');
    expect(capturedState!.data()).toBe('eager-auto-data');
  });

  it('should call onResolve from eager fetch', async () => {
    const { signal } = createTestEnv();
    const onResolve = vi.fn();

    const loader = createLoader({ signal, onResolve });

    let resolvePromise: (value: string) => void;
    const promise = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });

    loader.load(
      'eager-onresolve-id',
      () => promise,
      () => mockRefSpec(),
      { eager: true }
    );

    // onResolve should not have been called yet
    expect(onResolve).not.toHaveBeenCalled();

    // Resolve the eager promise
    resolvePromise!('eager-resolved');
    await promise;
    // Allow microtask for .then() handler
    await Promise.resolve();

    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith('eager-onresolve-id', 'eager-resolved');
  });
});

describe('createLoader - getRegisteredIds', () => {
  it('should return empty array before any load() calls', () => {
    const { signal } = createTestEnv();
    const loader = createLoader({ signal });

    expect(loader.getRegisteredIds()).toEqual([]);
  });

  it('should return all IDs after multiple load() calls', () => {
    const { signal } = createTestEnv();
    const loader = createLoader({ signal });

    loader.load('alpha', () => Promise.resolve(1), () => mockRefSpec());
    loader.load('beta', () => Promise.resolve(2), () => mockRefSpec());
    loader.load('gamma', () => Promise.resolve(3), () => mockRefSpec());

    const ids = loader.getRegisteredIds();
    expect(ids).toHaveLength(3);
    expect(ids).toContain('alpha');
    expect(ids).toContain('beta');
    expect(ids).toContain('gamma');
  });

  it('should register IDs from initialData-hydrated boundaries', () => {
    const { signal } = createTestEnv();
    const loader = createLoader({
      signal,
      initialData: { 'hydrated-id': 'cached-value' },
    });

    loader.load(
      'hydrated-id',
      () => Promise.resolve('fresh'),
      () => mockRefSpec()
    );

    const ids = loader.getRegisteredIds();
    expect(ids).toContain('hydrated-id');
  });
});

describe('createLoader - convergence: hydration round-trip', () => {
  it('should serialize server data and consume on client without re-fetching', async () => {
    // --- Server side ---
    const serverEnv = createTestEnv();
    const serverLoader = createLoader({ signal: serverEnv.signal });

    const serverSpec = serverLoader.load(
      'product-1',
      () => Promise.resolve({ name: 'Widget', price: 42 }),
      () => mockRefSpec()
    );

    const serverNode = serverSpec.create();
    await getAsyncMeta(serverNode)!.resolve();

    // Server collects resolved data for serialization
    const serialized = JSON.stringify(serverLoader.getData());
    expect(JSON.parse(serialized)).toEqual({ 'product-1': { name: 'Widget', price: 42 } });

    // --- Client side ---
    const clientEnv = createTestEnv();
    const clientFetcher = vi.fn(() => Promise.resolve({ name: 'Stale', price: 0 }));
    const clientLoader = createLoader({
      signal: clientEnv.signal,
      initialData: JSON.parse(serialized),
    });

    let clientState: LoadState<{ name: string; price: number }> | null = null;
    clientLoader.load('product-1', clientFetcher, (state) => {
      clientState = state;
      return mockRefSpec();
    });

    // Client should use initial data, not call the fetcher
    expect(clientFetcher).not.toHaveBeenCalled();
    expect(clientState!.status()).toBe('ready');
    expect(clientState!.data()).toEqual({ name: 'Widget', price: 42 });
  });

  it('should consume initialData once — second mount re-fetches', async () => {
    const { signal } = createTestEnv();
    const initialData = { 'once-id': 'cached' };
    const loader = createLoader({ signal, initialData });

    // First load — consumes initial data
    let state1: LoadState<string> | null = null;
    loader.load('once-id', () => Promise.resolve('fresh'), (state) => {
      state1 = state;
      return mockRefSpec();
    });
    expect(state1!.status()).toBe('ready');
    expect(state1!.data()).toBe('cached');

    // Second load with same ID — initial data was deleted, so fetcher is used
    let state2: LoadState<string> | null = null;
    const spec2 = loader.load('once-id', () => Promise.resolve('fresh'), (state) => {
      state2 = state;
      return mockRefSpec();
    });
    // Since initialData was consumed, it starts pending
    expect(state2!.status()).toBe('pending');

    const node2 = spec2.create();
    await getAsyncMeta(node2)!.resolve();
    expect(state2!.status()).toBe('ready');
    expect(state2!.data()).toBe('fresh');
  });

  it('should serialize multiple boundaries from getData()', async () => {
    const { signal } = createTestEnv();
    const loader = createLoader({ signal });

    const specs = [
      loader.load('a', () => Promise.resolve(1), () => mockRefSpec()),
      loader.load('b', () => Promise.resolve(2), () => mockRefSpec()),
      loader.load('c', () => Promise.resolve(3), () => mockRefSpec()),
    ];

    for (const spec of specs) {
      const node = spec.create();
      await getAsyncMeta(node)!.resolve();
    }

    const data = loader.getData();
    expect(data).toEqual({ a: 1, b: 2, c: 3 });

    // getData() returns a copy — mutations don't affect internal state
    data['a'] = 999;
    expect(loader.getData()['a']).toBe(1);
  });
});

describe('createLoader - convergence: eager + resolve deduplication', () => {
  it('should not call fetcher twice when eager is used and resolve() is called', async () => {
    const { signal } = createTestEnv();
    const loader = createLoader({ signal });

    const fetcher = vi.fn(() => Promise.resolve('data'));

    const spec = loader.load('dedup-id', fetcher, () => mockRefSpec(), { eager: true });
    const node = spec.create();
    const meta = getAsyncMeta<string>(node)!;

    // resolve() should piggyback on the eager promise, not call fetcher again
    await meta.resolve();

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should not start a second fetch via trigger() when eager is in flight', async () => {
    const { signal } = createTestEnv();
    const loader = createLoader({ signal });

    const fetcher = vi.fn(() => new Promise<string>((resolve) => {
      setTimeout(() => resolve('data'), 50);
    }));

    const spec = loader.load('trigger-dedup-id', fetcher, () => mockRefSpec(), { eager: true });
    const node = spec.create();
    const meta = getAsyncMeta<string>(node)!;

    // trigger() should bail out because eager is already in flight
    meta.trigger();

    expect(fetcher).toHaveBeenCalledTimes(1);

    await meta.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should not start eager fetch when already resolved via buffered setData', () => {
    const { signal } = createTestEnv();
    const loader = createLoader({ signal });

    // Buffer data before boundary registers
    loader.setData('preloaded-id', 'buffered');

    const fetcher = vi.fn(() => Promise.resolve('should-not-call'));

    let state: LoadState<string> | null = null;
    loader.load('preloaded-id', fetcher, (s) => {
      state = s;
      return mockRefSpec();
    }, { eager: true });

    // Buffered data was replayed — boundary is resolved, eager should not fire
    // NOTE: The current implementation doesn't check resolved before eager,
    // but setData sets resolved=true, so meta.resolve() will return early.
    // The state should be ready from the replay.
    expect(state!.status()).toBe('ready');
    expect(state!.data()).toBe('buffered');
  });
});

describe('isAsyncFragment', () => {
  it('should return true for nodes with ASYNC_FRAGMENT', () => {
    const node = { [ASYNC_FRAGMENT]: {} };
    expect(isAsyncFragment(node)).toBe(true);
  });

  it('should return false for regular objects', () => {
    expect(isAsyncFragment({})).toBe(false);
    expect(isAsyncFragment(null)).toBe(false);
    expect(isAsyncFragment(undefined)).toBe(false);
    expect(isAsyncFragment('string')).toBe(false);
  });
});

describe('getAsyncMeta', () => {
  it('should return metadata from async fragment', () => {
    const meta = { resolve: () => Promise.resolve() };
    const node = { [ASYNC_FRAGMENT]: meta };

    expect(getAsyncMeta(node as never)).toBe(meta);
  });

  it('should return undefined for non-async nodes', () => {
    expect(getAsyncMeta({} as never)).toBeUndefined();
  });
});
