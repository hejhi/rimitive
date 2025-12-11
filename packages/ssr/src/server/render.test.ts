/**
 * Tests for streaming SSR functionality
 */

import { describe, it, expect } from 'vitest';
import { renderToStream } from './render';
import { createStreamWriter } from './stream';
import { createLoader } from '@lattice/view/load';
import type { LoadState } from '@lattice/view/load';
import { STATUS_REF_SPEC } from '@lattice/view/types';
import type { RefSpec, NodeRef } from '@lattice/view/types';
import { createSignalFactory } from '@lattice/signals/signal';
import { createGraphEdges } from '@lattice/signals/deps/graph-edges';
import { createScheduler } from '@lattice/signals/deps/scheduler';
import { createGraphTraversal } from '@lattice/signals/deps/graph-traversal';
import { parseHTML } from 'linkedom';
import type { Serialize } from './adapter';

// ============================================================================
// Test Fixtures
// ============================================================================

const serialize: Serialize = (el: unknown) => (el as { outerHTML: string }).outerHTML;

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
  it('should return initial HTML with pending states and resolve done when data arrives', async () => {
    const { signal } = createServerTestEnv();
    const chunks: string[] = [];
    const { chunk } = createStreamWriter('__TEST__');
    const loader = createLoader({
      signal,
      onResolve: (id, data) => chunks.push(chunk(id, data)),
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

    const result = renderToStream(AsyncContent, { mount: mockMount, serialize });

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

    const result = renderToStream(FailingContent, { mount: mockMount, serialize });

    expect(result.initialHtml).toContain('Loading...');
    await expect(result.done).resolves.toBeUndefined();
  });
});
