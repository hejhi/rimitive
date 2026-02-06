/**
 * Tests for renderToStream — eager load integration
 */

import { describe, it, expect, vi } from 'vitest';
import { renderToStream } from './render-to-stream';
import { createLoader } from '@rimitive/view/load';
import type { LoadState } from '@rimitive/view/load';
import {
  serialize,
  createMockRefSpec,
  createServerTestEnv,
  mockMount,
  mockInsertFragmentMarkers,
} from './test-fixtures';

describe('renderToStream - eager load integration', () => {
  it('should resolve eager load boundaries through renderToStream', async () => {
    const { signal } = createServerTestEnv();
    const chunks: Array<{ id: string; data: unknown }> = [];

    const loader = createLoader({
      signal,
      onResolve: (id, data) => chunks.push({ id, data }),
    });

    // Eager load — fetcher fires immediately
    const EagerContent = loader.load(
      'eager-ssr-1',
      () => Promise.resolve({ items: [1, 2, 3] }),
      (state: LoadState<{ items: number[] }>) => {
        const status = state.status();
        if (status === 'pending')
          return createMockRefSpec('<div>Loading...</div>');
        if (status === 'error')
          return createMockRefSpec('<div>Error</div>');
        return createMockRefSpec(`<div>Items: ${state.data()?.items.join(',')}</div>`);
      },
      { eager: true }
    );

    const result = renderToStream(EagerContent, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    expect(result.pendingCount).toBe(1);

    // done should resolve — the eager promise is already in flight
    await result.done;

    // onResolve should have been called
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ id: 'eager-ssr-1', data: { items: [1, 2, 3] } });
  });

  it('should piggyback resolve() on eager promise during SSR', async () => {
    const { signal } = createServerTestEnv();
    const fetchCount = { count: 0 };

    const loader = createLoader({ signal });

    const EagerContent = loader.load(
      'piggyback-ssr-1',
      () => {
        fetchCount.count++;
        return Promise.resolve('data');
      },
      () => createMockRefSpec('<div>Content</div>'),
      { eager: true }
    );

    const result = renderToStream(EagerContent, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    // resolve() is called by resolveAllAsyncFragments — it should piggyback
    await result.done;

    // Fetcher should only have been called once (eager), not twice (eager + resolve)
    expect(fetchCount.count).toBe(1);
  });

  it('should skip eager fetch when initialData is present during SSR', async () => {
    const { signal } = createServerTestEnv();
    const fetcher = vi.fn(() => Promise.resolve('should-not-call'));

    const loader = createLoader({
      signal,
      initialData: { 'hydrated-ssr-1': 'pre-loaded' },
    });

    let capturedState: LoadState<string> | null = null;
    const HydratedContent = loader.load(
      'hydrated-ssr-1',
      fetcher,
      (state: LoadState<string>) => {
        capturedState = state;
        if (state.status() === 'ready')
          return createMockRefSpec(`<div>${state.data()}</div>`);
        return createMockRefSpec('<div>Loading...</div>');
      },
      { eager: true }
    );

    const result = renderToStream(HydratedContent, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    // No pending boundaries because initialData resolved it immediately
    await result.done;

    expect(fetcher).not.toHaveBeenCalled();
    expect(capturedState!.status()).toBe('ready');
    expect(capturedState!.data()).toBe('pre-loaded');
  });
});
