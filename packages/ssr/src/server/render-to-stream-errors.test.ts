/**
 * Tests for renderToStream — error boundary integration
 */

import { describe, it, expect } from 'vitest';
import { renderToStream } from './render-to-stream';
import { createLoader } from '@rimitive/view/load';
import type { LoadState } from '@rimitive/view/load';
import { STATUS_REF_SPEC, STATUS_FRAGMENT } from '@rimitive/view/types';
import type { RefSpec, FragmentRef } from '@rimitive/view/types';
import { ASYNC_FRAGMENT } from '@rimitive/view/load';
import type { AsyncMeta } from '@rimitive/view/load';
import {
  ERROR_BOUNDARY,
  type ErrorBoundaryMeta,
} from '@rimitive/view/error-boundary';
import {
  serialize,
  createMockRefSpec,
  createServerTestEnv,
  mockMount,
  mockInsertFragmentMarkers,
} from './test-fixtures';

describe('renderToStream - error boundary integration', () => {
  it('should call setError on error boundary when nested load() rejects', async () => {
    const setErrorCalls: unknown[] = [];

    // Create an error boundary meta
    const boundaryMeta: ErrorBoundaryMeta = {
      setError: (err) => setErrorCalls.push(err),
      hasError: () => setErrorCalls.length > 0,
    };

    // Create a failing async fragment
    const fetchError = new Error('SSR fetch failed');
    const asyncMeta: AsyncMeta<string> = {
      id: 'failing-boundary-1',
      resolve: async () => {
        throw fetchError;
      },
      getData: () => undefined,
      setData: () => {},
      isResolved: () => false,
      trigger: () => {},
    };

    // Build tree: error boundary fragment → async fragment (as child)
    const asyncFragment: FragmentRef<unknown> & {
      [ASYNC_FRAGMENT]: AsyncMeta<string>;
    } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: asyncMeta,
      attach() {},
    };

    const boundaryFragment: FragmentRef<unknown> & {
      [ERROR_BOUNDARY]: ErrorBoundaryMeta;
    } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: asyncFragment,
      lastChild: asyncFragment,
      [ERROR_BOUNDARY]: boundaryMeta,
      attach() {},
    };

    const rootSpec: RefSpec<unknown> = {
      status: STATUS_REF_SPEC,
      create: () => boundaryFragment,
    };

    const result = renderToStream(rootSpec, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    expect(result.pendingCount).toBe(1);

    // Wait for resolution
    await result.done;

    // setError should have been called with the fetch error
    expect(setErrorCalls).toHaveLength(1);
    expect(setErrorCalls[0]).toBe(fetchError);
    expect(boundaryMeta.hasError()).toBe(true);
  });

  it('should silently catch errors for fragments without an error boundary', async () => {
    // Async fragment with no error boundary ancestor — error should be silently caught
    const fetchError = new Error('No boundary available');
    const asyncMeta: AsyncMeta<string> = {
      id: 'no-boundary-1',
      resolve: async () => {
        throw fetchError;
      },
      getData: () => undefined,
      setData: () => {},
      isResolved: () => false,
      trigger: () => {},
    };

    const asyncFragment: FragmentRef<unknown> & {
      [ASYNC_FRAGMENT]: AsyncMeta<string>;
    } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: asyncMeta,
      attach() {},
    };

    const rootSpec: RefSpec<unknown> = {
      status: STATUS_REF_SPEC,
      create: () => asyncFragment,
    };

    const result = renderToStream(rootSpec, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    // Should not throw — error is silently caught
    await expect(result.done).resolves.toBeUndefined();
  });

  it('should route error to nearest error boundary in nested structure', async () => {
    const outerErrors: unknown[] = [];
    const innerErrors: unknown[] = [];

    // Inner error boundary (closer to the async fragment)
    const innerBoundaryMeta: ErrorBoundaryMeta = {
      setError: (err) => innerErrors.push(err),
      hasError: () => innerErrors.length > 0,
    };

    // Outer error boundary
    const outerBoundaryMeta: ErrorBoundaryMeta = {
      setError: (err) => outerErrors.push(err),
      hasError: () => outerErrors.length > 0,
    };

    const fetchError = new Error('Nested fetch failed');
    const asyncMeta: AsyncMeta<string> = {
      id: 'nested-1',
      resolve: async () => {
        throw fetchError;
      },
      getData: () => undefined,
      setData: () => {},
      isResolved: () => false,
      trigger: () => {},
    };

    // Build tree: outer boundary → inner boundary → async fragment
    const asyncFragment: FragmentRef<unknown> & {
      [ASYNC_FRAGMENT]: AsyncMeta<string>;
    } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      [ASYNC_FRAGMENT]: asyncMeta,
      attach() {},
    };

    const innerBoundary: FragmentRef<unknown> & {
      [ERROR_BOUNDARY]: ErrorBoundaryMeta;
    } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: asyncFragment,
      lastChild: asyncFragment,
      [ERROR_BOUNDARY]: innerBoundaryMeta,
      attach() {},
    };

    const outerBoundary: FragmentRef<unknown> & {
      [ERROR_BOUNDARY]: ErrorBoundaryMeta;
    } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: innerBoundary,
      lastChild: innerBoundary,
      [ERROR_BOUNDARY]: outerBoundaryMeta,
      attach() {},
    };

    const rootSpec: RefSpec<unknown> = {
      status: STATUS_REF_SPEC,
      create: () => outerBoundary,
    };

    const result = renderToStream(rootSpec, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    await result.done;

    // Inner boundary (nearest) should have received the error
    expect(innerErrors).toHaveLength(1);
    expect(innerErrors[0]).toBe(fetchError);

    // Outer boundary should NOT have received the error
    expect(outerErrors).toHaveLength(0);
  });

  it('should still resolve done when error boundary catches the error', async () => {
    const { signal } = createServerTestEnv();

    // Use a real loader to test the full integration path
    const loader = createLoader({ signal });

    const fetchError = new Error('Loader fetch failed');
    const FailingContent = loader.load(
      'eb-fail-1',
      async () => {
        throw fetchError;
      },
      (state: LoadState<unknown>) => {
        const status = state.status();
        if (status === 'pending')
          return createMockRefSpec('<div>Loading...</div>');
        if (status === 'error')
          return createMockRefSpec('<div>Error occurred</div>');
        return createMockRefSpec('<div>Success</div>');
      }
    );

    // Mount the load spec, then wrap the result in an error boundary fragment
    const innerNode = FailingContent.create();

    const setErrorCalls: unknown[] = [];
    const boundaryMeta: ErrorBoundaryMeta = {
      setError: (err) => setErrorCalls.push(err),
      hasError: () => setErrorCalls.length > 0,
    };

    // Create error boundary fragment wrapping the async fragment
    const boundaryFragment: FragmentRef<unknown> & {
      [ERROR_BOUNDARY]: ErrorBoundaryMeta;
    } = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: innerNode,
      lastChild: innerNode,
      [ERROR_BOUNDARY]: boundaryMeta,
      attach() {},
    };

    const rootSpec: RefSpec<unknown> = {
      status: STATUS_REF_SPEC,
      create: () => boundaryFragment,
    };

    const result = renderToStream(rootSpec, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    // done should resolve (not hang or throw)
    await expect(result.done).resolves.toBeUndefined();

    // Error boundary should have been notified
    expect(setErrorCalls).toHaveLength(1);
    expect(setErrorCalls[0]).toBe(fetchError);
  });
});
