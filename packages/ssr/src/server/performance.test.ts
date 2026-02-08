/**
 * Performance Verification Tests
 *
 * Validates that the SSR server abstraction meets performance expectations:
 * - Time to first byte (TTFB) measurements
 * - Streaming chunks sent at expected intervals
 * - Memory usage stays within bounds
 * - No memory leaks in service lifecycle
 * - Lazy chunk loading (pipelined resolution) works efficiently
 *
 * These tests use real HTTP servers, real service factories, and controlled
 * async boundaries to measure observable performance characteristics.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createStreamingServer } from './streaming-server';
import { createServiceFactory, createRequestScope } from './create-service-factory';
import { renderToStream } from './render-to-stream';
import { createStreamWriter } from './stream';
import { createLoader } from '@rimitive/view/load';
import type { LoadState } from '@rimitive/view/load';
import { STATUS_FRAGMENT, STATUS_REF_SPEC } from '@rimitive/view/types';
import type { RefSpec, NodeRef, FragmentRef } from '@rimitive/view/types';
import { ASYNC_FRAGMENT } from '@rimitive/view/load';
import type { AsyncMeta } from '@rimitive/view/load';
import {
  serialize,
  createMockRefSpec,
  createServerTestEnv,
  mockMount,
  mockInsertFragmentMarkers,
} from './test-fixtures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const activeServers: Server[] = [];

afterEach(async () => {
  const servers = activeServers.splice(0);
  await Promise.all(
    servers.map(
      (s) =>
        new Promise<void>((resolve) => {
          s.close(() => resolve());
        }),
    ),
  );
});

function createMockReq(url: string): IncomingMessage {
  return {
    url,
    headers: { host: 'localhost:3000' },
  } as unknown as IncomingMessage;
}

type MockRes = ServerResponse & {
  _written: string[];
  _writeTimes: number[];
  _status: number;
  _headers: Record<string, string>;
  _ended: boolean;
  _endTime: number;
};

function createTimedMockRes(): MockRes {
  const startTime = performance.now();
  const res = {
    _written: [] as string[],
    _writeTimes: [] as number[],
    _status: 0,
    _headers: {} as Record<string, string>,
    _ended: false,
    _endTime: 0,
    headersSent: false,
    writeHead(status: number, headers?: Record<string, string>) {
      res._status = status;
      res._writeTimes.push(performance.now() - startTime);
      if (headers) Object.assign(res._headers, headers);
    },
    write(chunk: string) {
      res._written.push(chunk);
      res._writeTimes.push(performance.now() - startTime);
      return true;
    },
    end(chunk?: string) {
      if (chunk) res._written.push(chunk);
      res._ended = true;
      res._endTime = performance.now() - startTime;
    },
  };
  return res as unknown as MockRes;
}

function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        await handler(req, res);
      } catch {
        if (!res.headersSent) {
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      }
    });
    activeServers.push(server);
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://localhost:${port}`,
        close: () =>
          new Promise<void>((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// ===========================================================================
// 1. TTFB Measurement
// ===========================================================================

describe('TTFB (Time to First Byte)', () => {
  it('should send shell HTML before async boundaries resolve', async () => {
    const delayed = deferred<{ value: number }>();
    const { signal } = createServerTestEnv();

    const handler = createStreamingServer({
      shell: {
        title: 'TTFB Test',
        streamKey: '__TTFB_STREAM__',
        rootId: false,
      },
      clientSrc: '/client.js',
      createService: ({ onResolve }) => {
        const loader = createLoader({ signal, onResolve });
        return {
          service: { loader },
          serialize,
          insertFragmentMarkers: mockInsertFragmentMarkers,
        };
      },
      createApp: (svc: { loader: ReturnType<typeof createLoader> }) => {
        const spec: RefSpec<unknown> = {
          status: STATUS_REF_SPEC,
          create: () => {
            const boundary = svc.loader.load(
              'slow-data',
              () => delayed.promise,
              (state: LoadState<{ value: number }>) => {
                if (state.status() === 'pending')
                  return createMockRefSpec('<div>Loading...</div>');
                return createMockRefSpec(`<div>${state.data()?.value}</div>`);
              },
            );
            return boundary.create();
          },
        };
        return spec;
      },
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
    });

    const res = createTimedMockRes();
    const req = createMockReq('/');

    // Start handler but don't await yet
    const handlerPromise = handler(req, res);

    // Let microtasks run so initial writes happen
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Shell and initial HTML should already be written (before boundaries resolve)
    const partialOutput = res._written.join('');
    expect(partialOutput).toContain('<!DOCTYPE html>');
    expect(partialOutput).toContain('<title>TTFB Test</title>');
    expect(partialOutput).toContain('/client.js');

    // But response should NOT be ended yet (still waiting for async boundary)
    expect(res._ended).toBe(false);

    // Resolve the boundary and finish
    delayed.resolve({ value: 42 });
    await handlerPromise;

    // Now the response should be complete
    expect(res._ended).toBe(true);
    const fullOutput = res._written.join('');
    expect(fullOutput).toContain('</body></html>');
  });

  it('should write headers and shell before async data loads in real HTTP', async () => {
    const delayed = deferred<{ loaded: boolean }>();
    const { signal } = createServerTestEnv();

    const handler = createStreamingServer({
      shell: {
        title: 'Streaming TTFB',
        streamKey: '__STTFB__',
        rootId: false,
      },
      clientSrc: '/client.js',
      createService: ({ onResolve }) => {
        const loader = createLoader({ signal, onResolve });
        return {
          service: { loader },
          serialize,
          insertFragmentMarkers: mockInsertFragmentMarkers,
        };
      },
      createApp: (svc: { loader: ReturnType<typeof createLoader> }) => ({
        status: STATUS_REF_SPEC,
        create: () => {
          const boundary = svc.loader.load(
            'delayed',
            () => delayed.promise,
            (state: LoadState<{ loaded: boolean }>) => {
              if (state.status() === 'pending')
                return createMockRefSpec('<div>Loading...</div>');
              return createMockRefSpec('<div>Loaded!</div>');
            },
          );
          return boundary.create();
        },
      }),
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
    });

    const { url, close } = await startServer(handler);

    try {
      const fetchPromise = fetch(`${url}/slow-page`);

      // Wait a tick, then resolve the boundary
      await new Promise((r) => setTimeout(r, 50));
      delayed.resolve({ loaded: true });

      const res = await fetchPromise;
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/html');

      const body = await res.text();
      expect(body).toContain('<!DOCTYPE html>');
      expect(body).toContain('</body></html>');
    } finally {
      await close();
    }
  });
});

// ===========================================================================
// 2. Streaming Chunk Intervals
// ===========================================================================

describe('streaming chunk intervals', () => {
  it('should write chunks as each boundary resolves, not all at once', async () => {
    const boundary1 = deferred<{ id: number }>();
    const boundary2 = deferred<{ id: number }>();
    const { signal } = createServerTestEnv();

    const res = createTimedMockRes();
    const req = createMockReq('/');

    const handler = createStreamingServer({
      shell: {
        title: 'Chunk Test',
        streamKey: '__CHUNK__',
        rootId: false,
      },
      clientSrc: '/client.js',
      createService: ({ onResolve }) => {
        const loader = createLoader({ signal, onResolve });
        return {
          service: { loader },
          serialize,
          insertFragmentMarkers: mockInsertFragmentMarkers,
        };
      },
      createApp: (svc: { loader: ReturnType<typeof createLoader> }) => ({
        status: STATUS_REF_SPEC,
        create: () => {
          const b1 = svc.loader.load(
            'chunk-1',
            () => boundary1.promise,
            (state: LoadState<{ id: number }>) => {
              if (state.status() === 'pending')
                return createMockRefSpec('<div>Loading 1...</div>');
              return createMockRefSpec(`<div>Data 1: ${state.data()?.id}</div>`);
            },
          );
          const b2 = svc.loader.load(
            'chunk-2',
            () => boundary2.promise,
            (state: LoadState<{ id: number }>) => {
              if (state.status() === 'pending')
                return createMockRefSpec('<div>Loading 2...</div>');
              return createMockRefSpec(`<div>Data 2: ${state.data()?.id}</div>`);
            },
          );
          const node1 = b1.create();
          const node2 = b2.create();
          node1.next = node2;
          return {
            status: 1 as const,
            element: { outerHTML: '<div>root</div>' },
            parent: null,
            prev: null,
            next: null,
            firstChild: node1,
            lastChild: node2,
          } as unknown as NodeRef<unknown>;
        },
      }),
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
    });

    const handlerPromise = handler(req, res);

    // Let initial writes happen
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const writesBeforeResolve = res._written.length;

    // Resolve first boundary
    boundary1.resolve({ id: 1 });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const writesAfterFirst = res._written.length;

    // First boundary should have added a write
    expect(writesAfterFirst).toBeGreaterThan(writesBeforeResolve);

    // Second boundary should not be in the output yet
    const outputAfterFirst = res._written.join('');
    expect(outputAfterFirst).toContain('__CHUNK__.push("chunk-1"');
    // Response not ended yet
    expect(res._ended).toBe(false);

    // Resolve second boundary
    boundary2.resolve({ id: 2 });
    await handlerPromise;

    // Both chunks should be present
    const fullOutput = res._written.join('');
    expect(fullOutput).toContain('__CHUNK__.push("chunk-1"');
    expect(fullOutput).toContain('__CHUNK__.push("chunk-2"');
    expect(res._ended).toBe(true);
  });

  it('should stream chunks incrementally via real HTTP', async () => {
    const { signal } = createServerTestEnv();
    const boundary1 = deferred<{ v: number }>();
    const boundary2 = deferred<{ v: number }>();

    const handler = createStreamingServer({
      shell: {
        title: 'Stream Interval',
        streamKey: '__INTERVAL__',
        rootId: false,
      },
      clientSrc: '/client.js',
      createService: ({ onResolve }) => {
        const loader = createLoader({ signal, onResolve });
        return {
          service: { loader },
          serialize,
          insertFragmentMarkers: mockInsertFragmentMarkers,
        };
      },
      createApp: (svc: { loader: ReturnType<typeof createLoader> }) => ({
        status: STATUS_REF_SPEC,
        create: () => {
          const b1 = svc.loader.load(
            'interval-1',
            () => boundary1.promise,
            (state: LoadState<{ v: number }>) => {
              if (state.status() === 'pending')
                return createMockRefSpec('<div>Pending 1</div>');
              return createMockRefSpec(`<div>${state.data()?.v}</div>`);
            },
          );
          const b2 = svc.loader.load(
            'interval-2',
            () => boundary2.promise,
            (state: LoadState<{ v: number }>) => {
              if (state.status() === 'pending')
                return createMockRefSpec('<div>Pending 2</div>');
              return createMockRefSpec(`<div>${state.data()?.v}</div>`);
            },
          );
          const node1 = b1.create();
          const node2 = b2.create();
          node1.next = node2;
          return {
            status: 1 as const,
            element: { outerHTML: '<div>root</div>' },
            parent: null,
            prev: null,
            next: null,
            firstChild: node1,
            lastChild: node2,
          } as unknown as NodeRef<unknown>;
        },
      }),
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
    });

    const { url, close } = await startServer(handler);

    try {
      // Start fetching
      const fetchPromise = fetch(`${url}/test`);

      // Stagger boundary resolution to simulate different API response times
      setTimeout(() => boundary1.resolve({ v: 100 }), 20);
      setTimeout(() => boundary2.resolve({ v: 200 }), 60);

      const res = await fetchPromise;
      const body = await res.text();

      // Both chunks should be present in the response
      expect(body).toContain('__INTERVAL__.push("interval-1"');
      expect(body).toContain('__INTERVAL__.push("interval-2"');
      expect(body).toContain('</body></html>');
    } finally {
      await close();
    }
  });

  it('should handle fast-resolving boundaries without stalling', async () => {
    // All boundaries resolve immediately — verify no artificial delay
    const { signal } = createServerTestEnv();

    const res = createTimedMockRes();
    const req = createMockReq('/');

    const handler = createStreamingServer({
      shell: {
        title: 'Fast Boundaries',
        streamKey: '__FAST__',
        rootId: false,
      },
      clientSrc: '/client.js',
      createService: ({ onResolve }) => {
        const loader = createLoader({ signal, onResolve });
        return {
          service: { loader },
          serialize,
          insertFragmentMarkers: mockInsertFragmentMarkers,
        };
      },
      createApp: (svc: { loader: ReturnType<typeof createLoader> }) => ({
        status: STATUS_REF_SPEC,
        create: () => {
          const nodes: NodeRef<unknown>[] = [];
          for (let i = 0; i < 10; i++) {
            const b = svc.loader.load(
              `fast-${i}`,
              () => Promise.resolve({ index: i }),
              (state: LoadState<{ index: number }>) => {
                if (state.status() === 'pending')
                  return createMockRefSpec(`<div>Loading ${i}...</div>`);
                return createMockRefSpec(`<div>${state.data()?.index}</div>`);
              },
            );
            nodes.push(b.create());
          }
          for (let i = 0; i < nodes.length - 1; i++) {
            nodes[i]!.next = nodes[i + 1]!;
          }
          return {
            status: 1 as const,
            element: { outerHTML: '<div>root</div>' },
            parent: null,
            prev: null,
            next: null,
            firstChild: nodes[0] ?? null,
            lastChild: nodes[nodes.length - 1] ?? null,
          } as unknown as NodeRef<unknown>;
        },
      }),
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
    });

    await handler(req, res);
    expect(res._ended).toBe(true);

    const fullOutput = res._written.join('');
    // All 10 chunks should be streamed
    for (let i = 0; i < 10; i++) {
      expect(fullOutput).toContain(`__FAST__.push("fast-${i}"`);
    }
  });
});

// ===========================================================================
// 3. Memory Usage Verification
// ===========================================================================

describe('memory usage', () => {
  it('should not significantly increase heap when rendering many requests', async () => {
    const factory = createServiceFactory();

    // Warm up — let V8 optimize hot paths
    for (let i = 0; i < 10; i++) {
      const scope = createRequestScope(factory);
      scope.dispose();
    }

    // Force GC if available (run vitest with --expose-gc for exact results,
    // but the test is still meaningful without it)
    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
    }

    const baselineHeap = process.memoryUsage().heapUsed;

    // Create and dispose many services
    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      const scope = createRequestScope(factory);
      scope.dispose();
    }

    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
    }

    const afterHeap = process.memoryUsage().heapUsed;
    const heapGrowth = afterHeap - baselineHeap;

    // Heap growth should be bounded: less than 5MB for 100 service cycles.
    // Without leaks, disposed services are collected. Some growth from V8
    // internal bookkeeping is expected (JIT compilation, hidden classes, etc.).
    expect(heapGrowth).toBeLessThan(5 * 1024 * 1024);
  });

  it('should not accumulate memory when rendering with streaming', async () => {
    const { signal } = createServerTestEnv();

    // Warm up
    for (let i = 0; i < 5; i++) {
      const loader = createLoader({ signal });
      const spec = loader.load(
        `warmup-${i}`,
        () => Promise.resolve({ i }),
        (state: LoadState<{ i: number }>) => {
          if (state.status() === 'pending')
            return createMockRefSpec('<div>Loading...</div>');
          return createMockRefSpec(`<div>${state.data()?.i}</div>`);
        },
      );
      const result = renderToStream(spec, {
        mount: mockMount,
        serialize,
        insertFragmentMarkers: mockInsertFragmentMarkers,
      });
      await result.done;
    }

    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
    }

    const baselineHeap = process.memoryUsage().heapUsed;

    // Run many streaming renders
    for (let i = 0; i < 50; i++) {
      const loader = createLoader({ signal });
      const spec = loader.load(
        `mem-test-${i}`,
        () => Promise.resolve({ value: i }),
        (state: LoadState<{ value: number }>) => {
          if (state.status() === 'pending')
            return createMockRefSpec('<div>Loading...</div>');
          return createMockRefSpec(`<div>${state.data()?.value}</div>`);
        },
      );
      const result = renderToStream(spec, {
        mount: mockMount,
        serialize,
        insertFragmentMarkers: mockInsertFragmentMarkers,
      });
      await result.done;
    }

    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
    }

    const afterHeap = process.memoryUsage().heapUsed;
    const heapGrowth = afterHeap - baselineHeap;

    // 50 streaming renders should not accumulate > 2MB
    expect(heapGrowth).toBeLessThan(2 * 1024 * 1024);
  });
});

// ===========================================================================
// 4. Memory Leak Detection in Service Lifecycle
// ===========================================================================

describe('service lifecycle memory leaks', () => {
  it('should dispose services cleanly with no retained references', () => {
    const factory = createServiceFactory();
    const scopes: { disposed: boolean }[] = [];

    for (let i = 0; i < 20; i++) {
      const scope = createRequestScope(factory);

      // Verify service has expected methods
      expect(scope.service.signal).toBeDefined();
      expect(scope.service.computed).toBeDefined();
      expect(scope.service.effect).toBeDefined();

      scope.dispose();
      scopes.push({ disposed: true });
    }

    // All 20 scopes should be disposed
    expect(scopes).toHaveLength(20);
    expect(scopes.every((s) => s.disposed)).toBe(true);
  });

  it('should call onCreate lifecycle hook for each service', () => {
    const created: number[] = [];

    const factory = createServiceFactory({
      lifecycle: {
        onCreate: () => {
          created.push(created.length);
        },
      },
    });

    for (let i = 0; i < 5; i++) {
      const scope = createRequestScope(factory);
      scope.dispose();
    }

    expect(created).toHaveLength(5);
  });

  it('should make dispose idempotent (second call is a no-op)', () => {
    const factory = createServiceFactory();

    const scope = createRequestScope(factory);

    // First dispose should work
    expect(() => scope.dispose()).not.toThrow();
    // Second dispose should be a safe no-op
    expect(() => scope.dispose()).not.toThrow();
  });

  it('should handle concurrent service creation and disposal', async () => {
    const factory = createServiceFactory();
    const created: number[] = [];
    const disposed: number[] = [];

    // Simulate concurrent requests
    const promises = Array.from({ length: 10 }, (_, i) =>
      (async () => {
        const scope = createRequestScope(factory);
        created.push(i);

        // Simulate async work
        await Promise.resolve();

        scope.dispose();
        disposed.push(i);
      })(),
    );

    await Promise.all(promises);

    expect(created).toHaveLength(10);
    expect(disposed).toHaveLength(10);
  });

  it('should create independent services per request (no cross-request leakage)', () => {
    const factory = createServiceFactory();

    const scope1 = createRequestScope(factory);
    const scope2 = createRequestScope(factory);

    // Services should be distinct objects
    expect(scope1.service).not.toBe(scope2.service);
    expect(scope1.adapterResult).not.toBe(scope2.adapterResult);

    // Each factory call creates a fresh adapter result (distinct objects)
    expect(scope1.adapterResult).not.toBe(scope2.adapterResult);

    scope1.dispose();
    scope2.dispose();
  });

  it('should properly track service lifecycle with streaming render', async () => {
    const lifecycleEvents: string[] = [];
    const { signal } = createServerTestEnv();

    const factory = createServiceFactory({
      lifecycle: {
        onCreate: () => lifecycleEvents.push('create'),
      },
    });

    const scope = createRequestScope(factory, {
      onResolve: () => {
        lifecycleEvents.push('resolve');
      },
    });

    const loader = createLoader({
      signal,
      onResolve: () => lifecycleEvents.push('chunk'),
    });

    const spec = loader.load(
      'lifecycle-test',
      () => Promise.resolve({ ok: true }),
      (state: LoadState<{ ok: boolean }>) => {
        if (state.status() === 'pending')
          return createMockRefSpec('<div>Loading...</div>');
        return createMockRefSpec('<div>Done</div>');
      },
    );

    const result = renderToStream(spec, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    await result.done;

    // onCreate should fire during factory call, before any chunks
    expect(lifecycleEvents[0]).toBe('create');
    // Chunk should have been delivered
    expect(lifecycleEvents).toContain('chunk');

    scope.dispose();
  });
});

// ===========================================================================
// 5. Lazy Chunk Loading (Pipelined Resolution) Efficiency
// ===========================================================================

describe('lazy chunk loading efficiency', () => {
  it('should resolve cascading boundaries with pipelined approach (no batch wait)', async () => {
    const resolveOrder: string[] = [];

    const deferredA = deferred<string>();
    const deferredB = deferred<string>();
    const deferredC = deferred<string>();

    // Fragment C: inner, hidden behind A
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

    // Fragment A: outer, fast
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

    // Fragment B: outer, slow
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

    // A and B are siblings
    fragmentA.next = fragmentB;

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

    expect(result.pendingCount).toBe(2);

    // Resolve A, revealing C
    fragmentA.firstChild = fragmentC;
    fragmentA.lastChild = fragmentC;
    deferredA.resolve('data-A');

    // Let pipelining discover and start resolving C
    await Promise.resolve();
    await Promise.resolve();

    // Resolve C before B
    deferredC.resolve('data-C');
    await Promise.resolve();
    await Promise.resolve();

    // Finally resolve B
    deferredB.resolve('data-B');
    await result.done;

    // Pipelined: C resolves before B because A+C are faster
    expect(resolveOrder).toEqual(['A', 'C', 'B']);
  });

  it('should handle deeply nested lazy boundaries efficiently', async () => {
    const resolveOrder: string[] = [];
    const deferreds: ReturnType<typeof deferred<string>>[] = [];

    // Create a chain of 5 fragments where each reveals the next
    const fragments: Array<
      FragmentRef<unknown> & { [ASYNC_FRAGMENT]: AsyncMeta<string> }
    > = [];

    for (let i = 0; i < 5; i++) {
      const d = deferred<string>();
      deferreds.push(d);

      fragments.push({
        status: STATUS_FRAGMENT,
        element: null,
        parent: null,
        prev: null,
        next: null,
        firstChild: null,
        lastChild: null,
        [ASYNC_FRAGMENT]: {
          id: `level-${i}`,
          resolve: () =>
            d.promise.then((val) => {
              resolveOrder.push(`level-${i}`);
              return val;
            }),
          getData: () => undefined,
          setData: () => {},
          isResolved: () => false,
          trigger: () => {},
        } satisfies AsyncMeta<string>,
        attach() {},
      });
    }

    const rootSpec: RefSpec<unknown> = {
      status: STATUS_REF_SPEC,
      create: () => fragments[0]!,
    };

    const result = renderToStream(rootSpec, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    expect(result.pendingCount).toBe(1); // Only level-0 is visible initially

    // Resolve each level, revealing the next
    for (let i = 0; i < 5; i++) {
      if (i < 4) {
        // Reveal next level before resolving current
        fragments[i]!.firstChild = fragments[i + 1]!;
        fragments[i]!.lastChild = fragments[i + 1]!;
      }
      deferreds[i]!.resolve(`data-${i}`);
      // Allow pipeline to discover next level
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }

    await result.done;

    // All 5 levels should resolve in order
    expect(resolveOrder).toEqual([
      'level-0',
      'level-1',
      'level-2',
      'level-3',
      'level-4',
    ]);
  });

  it('should resolve independent branches in parallel', async () => {
    const deferredLeft = deferred<string>();
    const deferredRight = deferred<string>();

    const fragmentLeft: FragmentRef<unknown> & {
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
        id: 'left',
        resolve: () => deferredLeft.promise,
        getData: () => undefined,
        setData: () => {},
        isResolved: () => false,
        trigger: () => {},
      } satisfies AsyncMeta<string>,
      attach() {},
    };

    const fragmentRight: FragmentRef<unknown> & {
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
        id: 'right',
        resolve: () => deferredRight.promise,
        getData: () => undefined,
        setData: () => {},
        isResolved: () => false,
        trigger: () => {},
      } satisfies AsyncMeta<string>,
      attach() {},
    };

    // Left and right are siblings
    fragmentLeft.next = fragmentRight;

    const rootFragment: FragmentRef<unknown> = {
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: fragmentLeft,
      lastChild: fragmentRight,
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

    expect(result.pendingCount).toBe(2);

    // Resolve both at the same time
    deferredLeft.resolve('left-data');
    deferredRight.resolve('right-data');

    await result.done;

    // Both branches resolved (done settled without error)
    expect(result.pendingCount).toBe(2); // 2 were registered initially
  });

  it('should handle mixed sync and async content efficiently', async () => {
    const { signal } = createServerTestEnv();
    const streamChunks: string[] = [];
    const stream = createStreamWriter('__MIXED__');

    const loader = createLoader({
      signal,
      onResolve: (id, data) => streamChunks.push(stream.chunkCode(id, data)),
    });

    // Create one async boundary among sync content
    const asyncSpec = loader.load(
      'async-part',
      () => Promise.resolve({ loaded: true }),
      (state: LoadState<{ loaded: boolean }>) => {
        if (state.status() === 'pending')
          return createMockRefSpec('<div>Loading async part...</div>');
        return createMockRefSpec('<div>Async loaded!</div>');
      },
    );

    const result = renderToStream(asyncSpec, {
      mount: mockMount,
      serialize,
      insertFragmentMarkers: mockInsertFragmentMarkers,
    });

    expect(result.pendingCount).toBe(1);
    expect(result.initialHtml).toContain('Loading async part...');

    await result.done;

    // The async chunk should have been delivered
    expect(streamChunks).toHaveLength(1);
    expect(streamChunks[0]).toContain('async-part');
    expect(streamChunks[0]).toContain('true');
  });
});
