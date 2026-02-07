/**
 * Tests for data prefetch handler
 *
 * Unit tests cover routing, path extraction, custom prefixes, and edge cases.
 * Integration tests verify:
 * - Various paths produce correct JSON data
 * - Prefetch data matches streaming data (same boundaries, same fetchers)
 * - Client-side prefetch flow (setData populates loader)
 * - No duplicate fetching when data is pre-cached
 */

import { describe, it, expect, vi } from 'vitest';
import { createDataPrefetchHandler } from './data-prefetch-handler';
import { renderToData } from './render-to-data';
import { renderToStream } from './render-to-stream';
import { createLoader } from '@rimitive/view/load';
import type { LoadState } from '@rimitive/view/load';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RefSpec, NodeRef } from '@rimitive/view/types';
import {
  createServerTestEnv,
  createMockRefSpec,
  serialize,
  mockInsertFragmentMarkers,
} from './test-fixtures';

function createMockReq(url: string): IncomingMessage {
  return {
    url,
    headers: { host: 'localhost:3000' },
  } as unknown as IncomingMessage;
}

function createMockRes(): ServerResponse & {
  _status: number;
  _headers: Record<string, string>;
  _body: string;
} {
  const res = {
    _status: 0,
    _headers: {} as Record<string, string>,
    _body: '',
    writeHead(status: number, headers?: Record<string, string>) {
      res._status = status;
      if (headers) Object.assign(res._headers, headers);
    },
    end(body?: string) {
      if (body) res._body = body;
    },
  };
  return res as unknown as ReturnType<typeof createMockRes>;
}

describe('createDataPrefetchHandler', () => {
  function createHandler(data: Record<string, unknown> = { key: 'value' }) {
    const createService = vi.fn((path: string) => ({
      path,
      loader: { getData: () => data },
    }));

    const mockNodeRef = {} as NodeRef<unknown>;

    const handler = createDataPrefetchHandler({
      createService,
      createApp: vi.fn((_svc) => ({}) as RefSpec<unknown>),
      mount: vi.fn((_svc) => (_spec: RefSpec<unknown>) => mockNodeRef),
      getData: (svc) => svc.loader.getData(),
    });

    return { handler, createService };
  }

  it('should handle /_data/ prefixed requests', async () => {
    const { handler } = createHandler({ metrics: { views: 100 } });
    const req = createMockReq('/_data/overview');
    const res = createMockRes();

    const handled = await handler(req, res);

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(res._body)).toEqual({ metrics: { views: 100 } });
  });

  it('should extract path from URL', async () => {
    const { handler, createService } = createHandler();
    const req = createMockReq('/_data/sites/site-1');
    const res = createMockRes();

    await handler(req, res);

    expect(createService).toHaveBeenCalledWith('/sites/site-1');
  });

  it('should return false for non-prefixed URLs', async () => {
    const { handler } = createHandler();
    const req = createMockReq('/api/data');
    const res = createMockRes();

    const handled = await handler(req, res);

    expect(handled).toBe(false);
    expect(res._status).toBe(0);
  });

  it('should return false for /_data without trailing slash', async () => {
    const { handler } = createHandler();
    const req = createMockReq('/_data');
    const res = createMockRes();

    const handled = await handler(req, res);

    expect(handled).toBe(false);
  });

  it('should return false when req.url is undefined', async () => {
    const { handler } = createHandler();
    const req = createMockReq(undefined as unknown as string);
    const res = createMockRes();

    const handled = await handler(req, res);

    expect(handled).toBe(false);
  });

  it('should support custom prefix', async () => {
    const createService = vi.fn((_path: string) => ({
      loader: { getData: () => ({ ok: true }) },
    }));
    const mockNodeRef = {} as NodeRef<unknown>;

    const handler = createDataPrefetchHandler({
      prefix: '/_prefetch',
      createService,
      createApp: vi.fn((_svc) => ({}) as RefSpec<unknown>),
      mount: vi.fn((_svc) => (_spec: RefSpec<unknown>) => mockNodeRef),
      getData: (svc) => svc.loader.getData(),
    });

    const req = createMockReq('/_prefetch/path');
    const res = createMockRes();

    const handled = await handler(req, res);

    expect(handled).toBe(true);
    expect(createService).toHaveBeenCalledWith('/path');
  });

  it('should handle root path data request', async () => {
    const { handler, createService } = createHandler();
    const req = createMockReq('/_data/');
    const res = createMockRes();

    await handler(req, res);

    expect(createService).toHaveBeenCalledWith('/');
  });
});

// =============================================================================
// Integration tests: real loader + async boundaries
// =============================================================================

describe('data prefetch handler — integration', () => {
  type BoundaryDef = {
    id: string;
    fetcher: () => Promise<unknown>;
  };

  function createIntegrationHandler(makeBoundaries: (path: string) => BoundaryDef[]) {
    const { signal } = createServerTestEnv();

    const handler = createDataPrefetchHandler({
      createService: (path: string) => {
        const loader = createLoader({ signal });
        const boundaries = makeBoundaries(path);
        return { loader, boundaries };
      },
      createApp: (svc) => {
        const specs = svc.boundaries.map((b) =>
          svc.loader.load(
            b.id,
            b.fetcher,
            (state: LoadState<unknown>) => {
              if (state.status() === 'ready')
                return createMockRefSpec(`<div data-id="${b.id}">${JSON.stringify(state.data())}</div>`);
              return createMockRefSpec(`<div data-id="${b.id}">Loading...</div>`);
            },
          ),
        );

        // Build a container spec wrapping all boundary specs
        const containerSpec: RefSpec<unknown> = {
          status: 4 as RefSpec<unknown>['status'],
          create: () => {
            const childNodes = specs.map((s) => s.create());
            for (let i = 0; i < childNodes.length - 1; i++) {
              childNodes[i].next = childNodes[i + 1];
            }
            return {
              status: 1 as const,
              element: { outerHTML: '<div class="app">content</div>' },
              parent: null,
              prev: null,
              next: null,
              firstChild: childNodes[0] ?? null,
              lastChild: childNodes[childNodes.length - 1] ?? null,
            } as unknown as NodeRef<unknown>;
          },
        };
        return containerSpec;
      },
      mount: (_svc) => (spec: RefSpec<unknown>) => spec.create(),
      getData: (svc) => svc.loader.getData(),
    });

    return handler;
  }

  it('should return JSON data for /_data/overview path', async () => {
    const handler = createIntegrationHandler(() => [
      { id: 'metrics', fetcher: () => Promise.resolve({ visitors: 24521, pageViews: 100230 }) },
      { id: 'top-pages', fetcher: () => Promise.resolve([{ path: '/', views: 45230 }]) },
    ]);

    const req = createMockReq('/_data/overview');
    const res = createMockRes();

    const handled = await handler(req, res);

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('application/json');

    const data = JSON.parse(res._body);
    expect(data).toEqual({
      metrics: { visitors: 24521, pageViews: 100230 },
      'top-pages': [{ path: '/', views: 45230 }],
    });
  });

  it('should return JSON data for nested path /_data/sites/site-1', async () => {
    const handler = createIntegrationHandler((path) => {
      const siteId = path.split('/').pop();
      return [
        { id: `site-detail-${siteId}`, fetcher: () => Promise.resolve({ name: `Site ${siteId}` }) },
        { id: `site-traffic-${siteId}`, fetcher: () => Promise.resolve({ daily: [100, 200] }) },
      ];
    });

    const req = createMockReq('/_data/sites/site-1');
    const res = createMockRes();

    await handler(req, res);

    const data = JSON.parse(res._body);
    expect(data).toEqual({
      'site-detail-site-1': { name: 'Site site-1' },
      'site-traffic-site-1': { daily: [100, 200] },
    });
  });

  it('should return JSON data for single-boundary path /_data/feed', async () => {
    const handler = createIntegrationHandler(() => [
      { id: 'feed-events', fetcher: () => Promise.resolve([{ type: 'visit', ts: 1000 }]) },
    ]);

    const req = createMockReq('/_data/feed');
    const res = createMockRes();

    await handler(req, res);

    const data = JSON.parse(res._body);
    expect(data).toEqual({
      'feed-events': [{ type: 'visit', ts: 1000 }],
    });
  });

  it('should return empty object for paths with no async boundaries', async () => {
    const handler = createIntegrationHandler(() => []);

    const req = createMockReq('/_data/static-page');
    const res = createMockRes();

    await handler(req, res);

    const data = JSON.parse(res._body);
    expect(data).toEqual({});
  });
});

// =============================================================================
// Data consistency: prefetch data matches streaming data
// =============================================================================

describe('data prefetch vs streaming consistency', () => {
  type BoundaryDef = {
    id: string;
    fetcher: () => Promise<unknown>;
    pendingHtml: string;
  };

  /**
   * Collect data via the prefetch path (renderToData)
   */
  async function collectPrefetchData(boundaries: BoundaryDef[]) {
    const { signal } = createServerTestEnv();
    const loader = createLoader({ signal });

    const specs = boundaries.map((b) =>
      loader.load(
        b.id,
        b.fetcher,
        (state: LoadState<unknown>) => {
          if (state.status() === 'ready')
            return createMockRefSpec(`<div data-id="${b.id}">${JSON.stringify(state.data())}</div>`);
          return createMockRefSpec(b.pendingHtml);
        },
      ),
    );

    const containerSpec: RefSpec<unknown> = {
      status: 4 as RefSpec<unknown>['status'],
      create: () => {
        const childNodes = specs.map((s) => s.create());
        for (let i = 0; i < childNodes.length - 1; i++) {
          childNodes[i].next = childNodes[i + 1];
        }
        return {
          status: 1 as const,
          element: { outerHTML: '<div>root</div>' },
          parent: null,
          prev: null,
          next: null,
          firstChild: childNodes[0] ?? null,
          lastChild: childNodes[childNodes.length - 1] ?? null,
        } as unknown as NodeRef<unknown>;
      },
    };

    return renderToData(containerSpec, {
      mount: (spec) => spec.create(),
      getData: () => loader.getData(),
    });
  }

  /**
   * Collect data via the streaming path (renderToStream + onResolve)
   */
  async function collectStreamingData(boundaries: BoundaryDef[]) {
    const { signal } = createServerTestEnv();
    const streamedData: Record<string, unknown> = {};

    const loader = createLoader({
      signal,
      onResolve: (id, data) => {
        streamedData[id] = data;
      },
    });

    const specs = boundaries.map((b) =>
      loader.load(
        b.id,
        b.fetcher,
        (state: LoadState<unknown>) => {
          if (state.status() === 'ready')
            return createMockRefSpec(`<div data-id="${b.id}">${JSON.stringify(state.data())}</div>`);
          return createMockRefSpec(b.pendingHtml);
        },
      ),
    );

    const containerSpec: RefSpec<unknown> = {
      status: 4 as RefSpec<unknown>['status'],
      create: () => {
        const childNodes = specs.map((s) => s.create());
        for (let i = 0; i < childNodes.length - 1; i++) {
          childNodes[i].next = childNodes[i + 1];
        }
        return {
          status: 1 as const,
          element: { outerHTML: '<div>root</div>' },
          parent: null,
          prev: null,
          next: null,
          firstChild: childNodes[0] ?? null,
          lastChild: childNodes[childNodes.length - 1] ?? null,
        } as unknown as NodeRef<unknown>;
      },
    };

    const { done } = renderToStream(containerSpec, {
      mount: (spec) => spec.create(),
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });
    await done;

    return streamedData;
  }

  it('should produce identical data for parallel boundaries', async () => {
    const boundaries: BoundaryDef[] = [
      { id: 'metrics', fetcher: () => Promise.resolve({ visitors: 24521 }), pendingHtml: '<div>Loading...</div>' },
      { id: 'top-pages', fetcher: () => Promise.resolve([{ path: '/', views: 45230 }]), pendingHtml: '<div>Loading...</div>' },
      { id: 'referrers', fetcher: () => Promise.resolve([{ source: 'Google', visitors: 12340 }]), pendingHtml: '<div>Loading...</div>' },
    ];

    const [prefetchData, streamingData] = await Promise.all([
      collectPrefetchData(boundaries),
      collectStreamingData(boundaries),
    ]);

    expect(prefetchData).toEqual(streamingData);
  });

  it('should produce identical data for a single boundary', async () => {
    const boundaries: BoundaryDef[] = [
      { id: 'feed-events', fetcher: () => Promise.resolve([{ type: 'visit', ts: 1000 }]), pendingHtml: '<div>Loading...</div>' },
    ];

    const [prefetchData, streamingData] = await Promise.all([
      collectPrefetchData(boundaries),
      collectStreamingData(boundaries),
    ]);

    expect(prefetchData).toEqual(streamingData);
  });

  it('should produce identical data for deeply nested structures', async () => {
    const boundaries: BoundaryDef[] = [
      {
        id: 'complex-data',
        fetcher: () => Promise.resolve({
          nested: { a: 1, b: { c: [1, 2, 3] } },
          list: [{ id: 'x', value: true }],
        }),
        pendingHtml: '<div>Loading...</div>',
      },
    ];

    const [prefetchData, streamingData] = await Promise.all([
      collectPrefetchData(boundaries),
      collectStreamingData(boundaries),
    ]);

    expect(prefetchData).toEqual(streamingData);
  });
});

// =============================================================================
// Client-side prefetch: setData populates loader, no duplicate fetching
// =============================================================================

describe('client-side prefetch via loader.setData', () => {
  it('should populate loader boundaries with prefetched data', () => {
    const { signal } = createServerTestEnv();
    const loader = createLoader({ signal });

    // Register load boundaries (simulates client mount)
    loader.load(
      'metrics',
      () => Promise.resolve({ visitors: 0 }),
      (state: LoadState<{ visitors: number }>) => {
        if (state.status() === 'ready')
          return createMockRefSpec(`<div>${state.data()?.visitors}</div>`);
        return createMockRefSpec('<div>Loading...</div>');
      },
    );

    loader.load(
      'top-pages',
      () => Promise.resolve([]),
      (state: LoadState<Array<{ path: string }>>) => {
        if (state.status() === 'ready')
          return createMockRefSpec(`<div>${JSON.stringify(state.data())}</div>`);
        return createMockRefSpec('<div>Loading...</div>');
      },
    );

    // Simulate prefetch response arriving (like createPrefetch does on the client)
    const prefetchedData: Record<string, unknown> = {
      metrics: { visitors: 24521 },
      'top-pages': [{ path: '/', views: 45230 }],
    };

    for (const [id, value] of Object.entries(prefetchedData)) {
      loader.setData(id, value);
    }

    // Verify data was correctly set in the loader
    const allData = loader.getData();
    expect(allData).toEqual(prefetchedData);
  });

  it('should buffer data for boundaries that register after prefetch arrives', () => {
    const { signal } = createServerTestEnv();
    const loader = createLoader({ signal });

    // Simulate prefetch data arriving BEFORE the boundary registers
    // (e.g., lazy chunk hasn't loaded yet on the client)
    loader.setData('lazy-boundary', { items: [1, 2, 3] });

    // Boundary registers later (lazy chunk loaded)
    loader.load(
      'lazy-boundary',
      () => Promise.resolve({ items: [] }),
      (state: LoadState<{ items: number[] }>) => {
        if (state.status() === 'ready')
          return createMockRefSpec(`<div>${JSON.stringify(state.data())}</div>`);
        return createMockRefSpec('<div>Loading...</div>');
      },
    );

    // Buffered data should have been replayed
    const allData = loader.getData();
    expect(allData).toEqual({ 'lazy-boundary': { items: [1, 2, 3] } });
  });

  it('should not re-fetch when data is pre-cached via initialData', async () => {
    const { signal } = createServerTestEnv();
    const fetcher = vi.fn(() => Promise.resolve({ visitors: 999 }));

    // Simulate client-side hydration with initial data from the server
    const loader = createLoader({
      signal,
      initialData: { metrics: { visitors: 24521 } },
    });

    const spec = loader.load('metrics', fetcher, (state: LoadState<{ visitors: number }>) => {
      if (state.status() === 'ready')
        return createMockRefSpec(`<div>${state.data()?.visitors}</div>`);
      return createMockRefSpec('<div>Loading...</div>');
    });

    // Mount the spec (triggers create)
    const nodeRef = spec.create();

    // Fetcher should NOT have been called — data came from initialData
    expect(fetcher).not.toHaveBeenCalled();

    // Resolve should return the cached initial data, not re-fetch
    const { ASYNC_FRAGMENT } = await import('@rimitive/view/load');
    const meta = (nodeRef as Record<symbol, { resolve: () => Promise<unknown>; isResolved: () => boolean }>)[ASYNC_FRAGMENT];
    expect(meta.isResolved()).toBe(true);

    const result = await meta.resolve();
    expect(result).toEqual({ visitors: 24521 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('should not re-fetch when data is pre-cached via setData', async () => {
    const { signal } = createServerTestEnv();
    const fetcher = vi.fn(() => Promise.resolve({ visitors: 999 }));

    const loader = createLoader({ signal });

    // Register boundary
    const spec = loader.load('metrics', fetcher, (state: LoadState<{ visitors: number }>) => {
      if (state.status() === 'ready')
        return createMockRefSpec(`<div>${state.data()?.visitors}</div>`);
      return createMockRefSpec('<div>Loading...</div>');
    });

    // Mount
    const nodeRef = spec.create();

    // Simulate prefetch data arriving (via client-side createPrefetch)
    loader.setData('metrics', { visitors: 24521 });

    // Now resolve the async fragment — should return the pre-cached data
    const { ASYNC_FRAGMENT } = await import('@rimitive/view/load');
    const meta = (nodeRef as Record<symbol, { resolve: () => Promise<unknown> }>)[ASYNC_FRAGMENT];
    const result = await meta.resolve();

    // resolve() should return the setData value, not call fetcher
    expect(result).toEqual({ visitors: 24521 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('should skip fetching for all boundaries when full prefetch data is available', async () => {
    const { signal } = createServerTestEnv();
    const metricsFetcher = vi.fn(() => Promise.resolve({ visitors: 0 }));
    const pagesFetcher = vi.fn(() => Promise.resolve([]));
    const referrersFetcher = vi.fn(() => Promise.resolve([]));

    // Client creates loader with initial data from SSR
    const loader = createLoader({
      signal,
      initialData: {
        metrics: { visitors: 24521 },
        'top-pages': [{ path: '/', views: 45230 }],
        referrers: [{ source: 'Google', visitors: 12340 }],
      },
    });

    // Register boundaries — same code runs on client and server
    loader.load('metrics', metricsFetcher, (state: LoadState<unknown>) => {
      return state.status() === 'ready'
        ? createMockRefSpec('<div>ready</div>')
        : createMockRefSpec('<div>loading</div>');
    });
    loader.load('top-pages', pagesFetcher, (state: LoadState<unknown>) => {
      return state.status() === 'ready'
        ? createMockRefSpec('<div>ready</div>')
        : createMockRefSpec('<div>loading</div>');
    });
    loader.load('referrers', referrersFetcher, (state: LoadState<unknown>) => {
      return state.status() === 'ready'
        ? createMockRefSpec('<div>ready</div>')
        : createMockRefSpec('<div>loading</div>');
    });

    // NONE of the fetchers should have been called
    expect(metricsFetcher).not.toHaveBeenCalled();
    expect(pagesFetcher).not.toHaveBeenCalled();
    expect(referrersFetcher).not.toHaveBeenCalled();
  });
});
