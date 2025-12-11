/**
 * Tests for streaming SSR functionality
 */

import { describe, it, expect } from 'vitest';
import {
  renderToStream,
  createStreamWriter,
  createStreamLoader,
} from './renderToStream';
import { createLoader } from '@lattice/view/load';
import type { LoadState } from '@lattice/view/load';
import { STATUS_REF_SPEC } from '@lattice/view/types';
import type { RefSpec, NodeRef } from '@lattice/view/types';
import { createSignalFactory } from '@lattice/signals/signal';
import { createGraphEdges } from '@lattice/signals/deps/graph-edges';
import { createScheduler } from '@lattice/signals/deps/scheduler';
import { createGraphTraversal } from '@lattice/signals/deps/graph-traversal';
import { parseHTML } from 'linkedom';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockRefSpec(html: string): RefSpec<unknown> {
  const { document } = parseHTML('<!DOCTYPE html><html></html>');
  const temp = document.createElement('template');
  temp.innerHTML = html;
  const element = temp.content.firstChild;

  return {
    status: STATUS_REF_SPEC,
    create: () => ({
      status: 1 as const,
      element,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    }),
  };
}

function createServerTestEnv() {
  const graphEdges = createGraphEdges();
  const { withVisitor } = createGraphTraversal();
  const scheduler = createScheduler({
    detachAll: graphEdges.detachAll,
    withVisitor,
  });

  const signal = createSignalFactory({
    graphEdges,
    propagate: scheduler.propagate,
  });

  return { signal };
}

function mockMount(spec: RefSpec<unknown>): NodeRef<unknown> {
  return spec.create();
}

// ============================================================================
// Tests
// ============================================================================

describe('renderToStream', () => {
  it('should return initial HTML with pending states, buffer chunks, and resolve done', async () => {
    const { signal } = createServerTestEnv();
    const stream = createStreamWriter('__TEST__');
    const { loader, getChunks } = createStreamLoader({ signal, stream });

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

    const result = renderToStream(AsyncContent, { mount: mockMount });

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

    // Should have buffered chunk with correct data
    const chunks = getChunks();
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

    const result = renderToStream(FailingContent, { mount: mockMount });

    expect(result.initialHtml).toContain('Loading...');
    await expect(result.done).resolves.toBeUndefined();
  });
});

describe('createStreamWriter', () => {
  it('should format chunk as script tag that pushes to proxy', () => {
    const stream = createStreamWriter('__APP__');
    const chunk = stream.chunk('user-123', {
      name: 'Alice',
      age: 30,
    });

    expect(chunk).toBe(
      '<script>__APP__.push("user-123",{"name":"Alice","age":30})</script>'
    );
  });

  it('should escape quotes in JSON strings', () => {
    const stream = createStreamWriter('__APP__');
    const chunk = stream.chunk('quote-test', {
      message: 'Hello "world"',
    });

    expect(chunk).toContain('Hello \\"world\\"');
  });

  it('should expose the stream key', () => {
    const stream = createStreamWriter('__MY_STREAM__');
    expect(stream.key).toBe('__MY_STREAM__');
  });

  it('should generate bootstrap script', () => {
    const stream = createStreamWriter('__BOOT__');
    const bootstrap = stream.bootstrap();

    expect(bootstrap).toContain('<script>');
    expect(bootstrap).toContain('window.__BOOT__');
    expect(bootstrap).toContain('push');
    expect(bootstrap).toContain('connect');
  });
});

describe('createStreamLoader', () => {
  it('should not fetch or generate chunks when initialData is provided', async () => {
    const { signal } = createServerTestEnv();
    const stream = createStreamWriter('__TEST__');

    const { loader, getChunks } = createStreamLoader({
      signal,
      stream,
      initialData: { 'hydrated-1': { message: 'From cache' } },
    });

    const AsyncContent = loader.load(
      'hydrated-1',
      async () => {
        throw new Error('Should not fetch when data is provided');
      },
      (state: LoadState<{ message: string }>) => {
        const status = state.status();
        if (status === 'pending')
          return createMockRefSpec('<div>Loading...</div>');
        if (status === 'error') return createMockRefSpec('<div>Error</div>');
        return createMockRefSpec(`<div>${state.data()?.message}</div>`);
      }
    );

    const result = renderToStream(AsyncContent, { mount: mockMount });
    await result.done;

    expect(getChunks()).toEqual([]);
  });

  it('should preserve chunk order based on resolution timing', async () => {
    const { signal } = createServerTestEnv();
    const stream = createStreamWriter('__TEST__');
    const { loader, getChunks } = createStreamLoader({ signal, stream });

    const SlowAsync = loader.load(
      'slow',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { speed: 'slow' };
      },
      (state: LoadState<{ speed: string }>) => {
        const status = state.status();
        if (status === 'pending')
          return createMockRefSpec('<div>Loading slow...</div>');
        return createMockRefSpec('<div>Slow done</div>');
      }
    );

    const FastAsync = loader.load(
      'fast',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { speed: 'fast' };
      },
      (state: LoadState<{ speed: string }>) => {
        const status = state.status();
        if (status === 'pending')
          return createMockRefSpec('<div>Loading fast...</div>');
        return createMockRefSpec('<div>Fast done</div>');
      }
    );

    const App: RefSpec<unknown> = {
      status: STATUS_REF_SPEC,
      create: () => {
        const { document } = parseHTML('<!DOCTYPE html><html></html>');
        const container = document.createElement('div');

        const node1 = SlowAsync.create();
        const node2 = FastAsync.create();

        if (node1.element) container.appendChild(node1.element as Node);
        if (node2.element) container.appendChild(node2.element as Node);

        const parentNode = {
          status: 1 as const,
          element: container,
          parent: null,
          prev: null,
          next: null,
          firstChild: node1,
          lastChild: node2,
        };

        node1.parent = parentNode;
        node1.prev = null;
        node1.next = node2;

        node2.parent = parentNode;
        node2.prev = node1;
        node2.next = null;

        return parentNode;
      },
    };

    const result = renderToStream(App, { mount: mockMount });
    await result.done;

    const chunks = getChunks();
    expect(chunks.length).toBe(2);

    const fastIndex = chunks.findIndex((c) => c.includes('fast'));
    const slowIndex = chunks.findIndex((c) => c.includes('slow'));

    expect(fastIndex).toBeLessThan(slowIndex);
  });
});
