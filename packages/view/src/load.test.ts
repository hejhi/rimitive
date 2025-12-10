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
