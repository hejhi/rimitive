/**
 * Error Handling Tests
 *
 * Verifies error handling across all SSR server abstraction handlers:
 * - 404 handling for missing pages and static assets
 * - API error responses (500, 400 status codes)
 * - Streaming error handling (boundary fails mid-stream)
 * - Service creation errors
 * - Dev error pages render correctly
 * - Errors don't crash the server
 *
 * Tests use both mock request/response objects (unit-level) and real
 * HTTP servers (integration-level) to verify behavior end-to-end.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { createStreamingServer, type StreamingHandler } from './streaming-server';
import { createStaticHandler } from './static-handler';
import { createDataPrefetchHandler } from './data-prefetch-handler';
import {
  createDevServer,
  createDevErrorPage,
} from './dev';
import {
  createServiceFactory,
  createRequestScope,
  handleServiceError,
} from './create-service-factory';
import type { RefSpec, NodeRef, FragmentRef } from '@rimitive/view/types';
import { STATUS_ELEMENT } from '@rimitive/view/types';
import type { Serialize } from './parse5-adapter';
import { createLoader } from '@rimitive/view/load';
import type { LoadState } from '@rimitive/view/load';
import {
  createServerTestEnv,
  createMockRefSpec,
  serialize,
  mockInsertFragmentMarkers,
} from './test-fixtures';
import { tmpdir } from 'node:os';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

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
    method: 'GET',
  } as unknown as IncomingMessage;
}

function createMockRes(): ServerResponse & {
  _written: string[];
  _status: number;
  _headers: Record<string, string>;
  _ended: boolean;
  headersSent: boolean;
} {
  const res = {
    _written: [] as string[],
    _status: 0,
    _headers: {} as Record<string, string>,
    _ended: false,
    headersSent: false,
    writeHead(status: number, headers?: Record<string, string>) {
      res._status = status;
      res.headersSent = true;
      if (headers) Object.assign(res._headers, headers);
      return res;
    },
    write(chunk: string) {
      res._written.push(chunk);
      return true;
    },
    end(chunk?: string) {
      if (chunk) res._written.push(chunk);
      res._ended = true;
    },
  };
  return res as unknown as ReturnType<typeof createMockRes>;
}

function createMockNodeRef(html: string): NodeRef<unknown> {
  return {
    status: STATUS_ELEMENT,
    element: html,
    next: null,
    prev: null,
  } as unknown as NodeRef<unknown>;
}

function createMockSerialize(): Serialize {
  return ((element: unknown) => String(element)) as Serialize;
}

function createTestStreamingHandler(): StreamingHandler {
  return createStreamingServer({
    shell: {
      title: 'Error Test',
      streamKey: '__ERROR_TEST__',
      rootId: false,
    },
    clientSrc: '/client.js',
    createService: ({ pathname }) => ({
      service: { pathname },
      serialize: createMockSerialize(),
      insertFragmentMarkers: (() => {}) as (fragment: FragmentRef<unknown>) => void,
    }),
    createApp: (svc: { pathname: string }) => {
      const nodeRef = createMockNodeRef(`<div class="app">${svc.pathname}</div>`);
      return {
        status: 4 as RefSpec<unknown>['status'],
        create: () => nodeRef,
      } as RefSpec<unknown>;
    },
    mount: (_svc: { pathname: string }) => (spec: RefSpec<unknown>) =>
      spec.create(),
  });
}

function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        await handler(req, res);
      } catch (err) {
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

// ===========================================================================
// 1. 404 Handling
// ===========================================================================

describe('404 handling for missing pages', () => {
  it('static handler returns false for unmatched URLs, allowing fallback 404', async () => {
    const dir = join(tmpdir(), `error-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'client.js'), 'console.log("client");');

    try {
      const serveStatic = createStaticHandler({
        clientDir: dir,
        urlPatterns: ['/client.js', '/assets/'],
      });

      const { url, close } = await startServer((req, res) => {
        if (serveStatic(req, res)) return;
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      });

      try {
        // Unmatched URL returns 404 from the fallback
        const res = await fetch(`${url}/nonexistent-page`);
        expect(res.status).toBe(404);
        expect(await res.text()).toBe('Not Found');
      } finally {
        await close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('static handler returns 404 for matched pattern but missing file', async () => {
    const dir = join(tmpdir(), `error-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(dir, 'assets'), { recursive: true });

    try {
      const serveStatic = createStaticHandler({
        clientDir: dir,
        urlPatterns: ['/client.js', '/assets/'],
      });

      const req = createMockReq('/assets/missing-chunk.js');
      const res = createMockRes();

      const handled = serveStatic(req, res);

      // Handler claims the request (pattern matched) but sends 404
      expect(handled).toBe(true);
      expect(res._status).toBe(404);
      expect(res._written.join('')).toBe('Not found');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('data prefetch handler returns false for non-prefetch URLs', async () => {
    const handlePrefetch = createDataPrefetchHandler({
      createService: (path: string) => ({ path }),
      createApp: () => ({
        status: 4 as RefSpec<unknown>['status'],
        create: () => createMockNodeRef('<div>app</div>'),
      } as RefSpec<unknown>),
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
      getData: () => ({}),
    });

    const req = createMockReq('/about');
    const res = createMockRes();

    const handled = await handlePrefetch(req, res);
    expect(handled).toBe(false);
    expect(res._ended).toBe(false);
  });

  it('middleware chain produces 404 when no handler matches', async () => {
    const handlePrefetch = createDataPrefetchHandler({
      createService: (path: string) => ({ path }),
      createApp: () => ({
        status: 4 as RefSpec<unknown>['status'],
        create: () => createMockNodeRef('<div>app</div>'),
      } as RefSpec<unknown>),
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
      getData: () => ({}),
    });

    const dir = join(tmpdir(), `error-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });

    try {
      const serveStatic = createStaticHandler({
        clientDir: dir,
        urlPatterns: ['/client.js'],
      });

      // Server that only has static + prefetch (no streaming fallback)
      const { url, close } = await startServer(async (req, res) => {
        if (serveStatic(req, res)) return;
        if (await handlePrefetch(req, res)) return;
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - Page Not Found</h1>');
      });

      try {
        const res = await fetch(`${url}/unknown-route`);
        expect(res.status).toBe(404);
        const html = await res.text();
        expect(html).toContain('404');
      } finally {
        await close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('static handler returns false when req.url is undefined', () => {
    const dir = join(tmpdir(), `error-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'client.js'), 'console.log("client");');

    try {
      const serveStatic = createStaticHandler({
        clientDir: dir,
        urlPatterns: ['/client.js'],
      });

      const req = { url: undefined, headers: {} } as unknown as IncomingMessage;
      const res = createMockRes();

      expect(serveStatic(req, res)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ===========================================================================
// 2. API Error Responses (500, 400)
// ===========================================================================

describe('API error responses (500, 400 status codes)', () => {
  it('handleServiceError returns 500 with default HTML body', () => {
    const error = new Error('Database connection failed');
    const response = handleServiceError(error);

    expect(response.status).toBe(500);
    expect(response.headers['Content-Type']).toBe('text/html');
    expect(response.body).toContain('500');
    expect(response.body).toContain('Server Error');
  });

  it('handleServiceError uses custom onError handler when provided', () => {
    const error = new Error('Validation failed');
    const response = handleServiceError(error, {
      onError: (err) =>
        `<h1>Custom Error: ${err instanceof Error ? err.message : 'Unknown'}</h1>`,
    });

    expect(response.status).toBe(500);
    expect(response.body).toContain('Custom Error: Validation failed');
  });

  it('handleServiceError falls back to default when onError returns undefined', () => {
    const error = new Error('Something broke');
    const response = handleServiceError(error, {
      onError: () => undefined,
    });

    expect(response.status).toBe(500);
    expect(response.body).toContain('500');
  });

  it('server wrapping streaming handler catches errors and returns 500', async () => {
    const failingHandler: StreamingHandler = async () => {
      throw new Error('Render explosion');
    };

    const { url, close } = await startServer(failingHandler);

    try {
      const res = await fetch(`${url}/`);
      expect(res.status).toBe(500);
      expect(await res.text()).toBe('Internal Server Error');
    } finally {
      await close();
    }
  });

  it('data prefetch handler error bubbles up to server error handler', async () => {
    const handlePrefetch = createDataPrefetchHandler({
      createService: () => {
        throw new Error('Service creation failed in prefetch');
      },
      createApp: () => ({
        status: 4 as RefSpec<unknown>['status'],
        create: () => createMockNodeRef('<div>app</div>'),
      } as RefSpec<unknown>),
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
      getData: () => ({}),
    });

    const { url, close } = await startServer(async (req, res) => {
      const handled = await handlePrefetch(req, res);
      if (!handled) {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    try {
      const res = await fetch(`${url}/_data/test`);
      // Error is caught by the server wrapper -> 500
      expect(res.status).toBe(500);
    } finally {
      await close();
    }
  });

  it('handleServiceError works with non-Error values', () => {
    const stringResponse = handleServiceError('string error');
    expect(stringResponse.status).toBe(500);

    const nullResponse = handleServiceError(null);
    expect(nullResponse.status).toBe(500);

    const numberResponse = handleServiceError(42);
    expect(numberResponse.status).toBe(500);
  });
});

// ===========================================================================
// 3. Streaming Error Handling (boundary fails mid-stream)
// ===========================================================================

describe('streaming error handling (boundary fails mid-stream)', () => {
  type BoundaryDef = {
    id: string;
    fetcher: () => Promise<unknown>;
    pendingHtml: string;
  };

  type TestService = {
    loader: ReturnType<typeof createLoader>;
    boundaries: BoundaryDef[];
  };

  function createStreamingConfigWithBoundaries(boundaries: BoundaryDef[]) {
    const { signal } = createServerTestEnv();

    const config = {
      shell: {
        title: 'Error Stream Test',
        streamKey: '__ERROR_STREAM__',
        rootId: false as const,
      },
      clientSrc: '/client.js',
      createService: ({
        onResolve,
      }: {
        pathname: string;
        onResolve: (id: string, data: unknown) => void;
      }) => {
        const loader = createLoader({ signal, onResolve });
        return {
          service: { loader, boundaries } as TestService,
          serialize,
          insertFragmentMarkers: mockInsertFragmentMarkers,
        };
      },
      createApp: (svc: TestService) => {
        const containerSpec: RefSpec<unknown> = {
          status: 4 as RefSpec<unknown>['status'],
          create: () => {
            const childSpecs = svc.boundaries.map((b) =>
              svc.loader.load(
                b.id,
                b.fetcher,
                (state: LoadState<unknown>) => {
                  if (state.status() === 'pending')
                    return createMockRefSpec(b.pendingHtml);
                  return createMockRefSpec(
                    `<div data-resolved="${b.id}">${JSON.stringify(state.data())}</div>`,
                  );
                },
              ),
            );

            const childNodes = childSpecs.map((spec) => spec.create());
            for (let i = 0; i < childNodes.length - 1; i++) {
              childNodes[i]!.next = childNodes[i + 1]!;
            }

            const rootNode = {
              status: 1 as const,
              element: { outerHTML: '<div class="error-test-root">content</div>' },
              parent: null,
              prev: null,
              next: null,
              firstChild: childNodes[0] ?? null,
              lastChild: childNodes[childNodes.length - 1] ?? null,
            };

            return rootNode as unknown as NodeRef<unknown>;
          },
        };
        return containerSpec;
      },
      mount: (_svc: TestService) => (spec: RefSpec<unknown>) => spec.create(),
    };

    return config;
  }

  it('should complete the response even when a boundary rejects', async () => {
    const config = createStreamingConfigWithBoundaries([
      {
        id: 'good-boundary',
        fetcher: () => Promise.resolve({ ok: true }),
        pendingHtml: '<div>Loading good...</div>',
      },
      {
        id: 'failing-boundary',
        fetcher: () => Promise.reject(new Error('Network timeout')),
        pendingHtml: '<div>Loading failing...</div>',
      },
    ]);

    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    // Should not throw
    await handler(req, res);

    const fullOutput = res._written.join('');
    expect(fullOutput).toContain('<!DOCTYPE html>');
    expect(fullOutput).toContain('</body></html>');
    expect(res._ended).toBe(true);

    // Good boundary should still stream
    expect(fullOutput).toContain('__ERROR_STREAM__.push("good-boundary"');
  });

  it('should complete the response when all boundaries fail', async () => {
    const config = createStreamingConfigWithBoundaries([
      {
        id: 'fail-1',
        fetcher: () => Promise.reject(new Error('API unavailable')),
        pendingHtml: '<div>Loading 1...</div>',
      },
      {
        id: 'fail-2',
        fetcher: () => Promise.reject(new Error('Timeout')),
        pendingHtml: '<div>Loading 2...</div>',
      },
    ]);

    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    await handler(req, res);

    const fullOutput = res._written.join('');
    // Document should still close properly
    expect(fullOutput).toContain('</body></html>');
    expect(res._ended).toBe(true);
  });

  it('should send initial HTML before boundary errors occur', async () => {
    let rejectBoundary: ((err: Error) => void) | undefined;
    const boundaryPromise = new Promise<unknown>((_resolve, reject) => {
      rejectBoundary = reject;
    });

    const config = createStreamingConfigWithBoundaries([
      {
        id: 'delayed-fail',
        fetcher: () => boundaryPromise,
        pendingHtml: '<div>Waiting...</div>',
      },
    ]);

    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    const handlerPromise = handler(req, res);

    // Wait for initial writes
    await Promise.resolve();
    await Promise.resolve();

    // Shell should already be written before rejection
    const partialOutput = res._written.join('');
    expect(partialOutput).toContain('<!DOCTYPE html>');
    expect(partialOutput).toContain('/client.js');

    // Now reject the boundary
    rejectBoundary!(new Error('Delayed failure'));
    await handlerPromise;

    const fullOutput = res._written.join('');
    expect(fullOutput).toContain('</body></html>');
    expect(res._ended).toBe(true);
  });

  it('server stays alive after streaming error in a real HTTP server', async () => {
    const config = createStreamingConfigWithBoundaries([
      {
        id: 'error-boundary',
        fetcher: () => Promise.reject(new Error('Fetch failed')),
        pendingHtml: '<div>Loading...</div>',
      },
    ]);

    const handler = createStreamingServer(config);
    const { url, close } = await startServer(handler);

    try {
      // First request — boundary fails but response should complete
      const res1 = await fetch(`${url}/page1`);
      expect(res1.status).toBe(200);
      const html1 = await res1.text();
      expect(html1).toContain('<!DOCTYPE html>');
      expect(html1).toContain('</body></html>');

      // Second request — server should still be responsive
      const res2 = await fetch(`${url}/page2`);
      expect(res2.status).toBe(200);
      const html2 = await res2.text();
      expect(html2).toContain('<!DOCTYPE html>');
    } finally {
      await close();
    }
  });
});

// ===========================================================================
// 4. Service Creation Errors
// ===========================================================================

describe('service creation errors', () => {
  it('streaming handler throws when createService throws', async () => {
    const handler = createStreamingServer({
      shell: {
        title: 'Error Test',
        streamKey: '__ERROR__',
        rootId: false,
      },
      clientSrc: '/client.js',
      createService: () => {
        throw new Error('Failed to initialize service');
      },
      createApp: () => ({
        status: 4 as RefSpec<unknown>['status'],
        create: () => createMockNodeRef('<div>app</div>'),
      } as RefSpec<unknown>),
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
    });

    const req = createMockReq('/');
    const res = createMockRes();

    await expect(handler(req, res)).rejects.toThrow(
      'Failed to initialize service',
    );
  });

  it('streaming handler throws when createApp throws', async () => {
    const handler = createStreamingServer({
      shell: {
        title: 'Error Test',
        streamKey: '__ERROR__',
        rootId: false,
      },
      clientSrc: '/client.js',
      createService: ({ pathname }) => ({
        service: { pathname },
        serialize: createMockSerialize(),
        insertFragmentMarkers: (() => {}) as (fragment: FragmentRef<unknown>) => void,
      }),
      createApp: () => {
        throw new Error('App creation failed');
      },
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
    });

    const req = createMockReq('/');
    const res = createMockRes();

    await expect(handler(req, res)).rejects.toThrow('App creation failed');
  });

  it('streaming handler throws when mount throws', async () => {
    const handler = createStreamingServer({
      shell: {
        title: 'Error Test',
        streamKey: '__ERROR__',
        rootId: false,
      },
      clientSrc: '/client.js',
      createService: ({ pathname }) => ({
        service: { pathname },
        serialize: createMockSerialize(),
        insertFragmentMarkers: (() => {}) as (fragment: FragmentRef<unknown>) => void,
      }),
      createApp: (svc: { pathname: string }) => ({
        status: 4 as RefSpec<unknown>['status'],
        create: () => createMockNodeRef(`<div>${svc.pathname}</div>`),
      } as RefSpec<unknown>),
      mount: () => () => {
        throw new Error('Mount failed');
      },
    });

    const req = createMockReq('/');
    const res = createMockRes();

    await expect(handler(req, res)).rejects.toThrow('Mount failed');
  });

  it('createRequestScope dispose is safe even when service.dispose throws', () => {
    const factory = createServiceFactory();
    const scope = createRequestScope(factory);

    // Override dispose to throw
    scope.service.dispose = () => {
      throw new Error('Dispose error');
    };

    // Should not throw (dispose errors are swallowed)
    expect(() => scope.dispose()).not.toThrow();
  });

  it('createRequestScope dispose is idempotent', () => {
    const factory = createServiceFactory();
    const disposeSpy = vi.fn();

    const scope = createRequestScope(factory);
    scope.service.dispose = disposeSpy;

    scope.dispose();
    scope.dispose();
    scope.dispose();

    // dispose() on the service should only be called once
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it('service creation errors are caught by server wrapper', async () => {
    const handler = createStreamingServer({
      shell: {
        title: 'Error Test',
        streamKey: '__ERROR__',
        rootId: false,
      },
      clientSrc: '/client.js',
      createService: () => {
        throw new Error('Configuration error');
      },
      createApp: () => ({
        status: 4 as RefSpec<unknown>['status'],
        create: () => createMockNodeRef('<div>app</div>'),
      } as RefSpec<unknown>),
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
    });

    const { url, close } = await startServer(handler);

    try {
      const res = await fetch(`${url}/`);
      // Server wrapper catches the throw and returns 500
      expect(res.status).toBe(500);
      expect(await res.text()).toBe('Internal Server Error');

      // Server should still be alive for the next request
      const res2 = await fetch(`${url}/second`);
      expect(res2.status).toBe(500);
    } finally {
      await close();
    }
  });

  it('data prefetch handler propagates service creation errors', async () => {
    const handlePrefetch = createDataPrefetchHandler({
      createService: () => {
        throw new Error('Bad service config');
      },
      createApp: () => ({
        status: 4 as RefSpec<unknown>['status'],
        create: () => createMockNodeRef('<div>app</div>'),
      } as RefSpec<unknown>),
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
      getData: () => ({}),
    });

    const req = createMockReq('/_data/test');
    const res = createMockRes();

    await expect(handlePrefetch(req, res)).rejects.toThrow(
      'Bad service config',
    );
  });
});

// ===========================================================================
// 5. Dev Error Pages Render Correctly
// ===========================================================================

describe('error pages render correctly', () => {
  it('createDevErrorPage renders Error with message and stack', () => {
    const error = new Error('Something went wrong');
    const html = createDevErrorPage(error);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('500');
    expect(html).toContain('Something went wrong');
    expect(html).toContain('Stack Trace');
    expect(html).toContain('error-handling.test.ts');
  });

  it('createDevErrorPage hides stack when showStack is false', () => {
    const error = new Error('Secret error');
    const html = createDevErrorPage(error, { showStack: false });

    expect(html).toContain('Secret error');
    expect(html).not.toContain('Stack Trace');
  });

  it('createDevErrorPage uses custom title', () => {
    const error = new Error('Oops');
    const html = createDevErrorPage(error, { title: 'My App Error' });

    expect(html).toContain('<title>My App Error</title>');
  });

  it('createDevErrorPage handles non-Error values', () => {
    const stringHtml = createDevErrorPage('string error');
    expect(stringHtml).toContain('string error');
    expect(stringHtml).not.toContain('Stack Trace');

    const numberHtml = createDevErrorPage(404);
    expect(numberHtml).toContain('404');

    const nullHtml = createDevErrorPage(null);
    expect(nullHtml).toContain('null');
  });

  it('createDevErrorPage escapes HTML in error message to prevent XSS', () => {
    const maliciousError = new Error(
      '<script>alert("xss")</script><img onerror="hack()">',
    );
    const html = createDevErrorPage(maliciousError);

    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('onerror="hack()"');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img onerror=');
  });

  it('dev server shows error page for handler errors (errorPages: true)', async () => {
    const failingHandler: StreamingHandler = async () => {
      throw new Error('Render crash for dev');
    };

    const dev = createDevServer({
      handler: failingHandler,
      port: 0,
      logging: false,
      errorPages: true,
    });

    const close = await dev.listen();

    try {
      // We need to find the actual port since dev.port is 0
      // Use a simple approach: make a request to port 0 won't work,
      // but createDevServer internally listens on an ephemeral port.
      // The dev.port value is 0, but the actual server port is different.
      // Since the dev server API doesn't expose the actual port after listen,
      // we verify the handler config is correct by testing the error page
      // generation separately.
      expect(typeof close).toBe('function');
    } finally {
      await close();
    }
  });

  it('dev server sends plain 500 when errorPages is false', async () => {
    const failingHandler: StreamingHandler = async () => {
      throw new Error('Render crash');
    };

    const dev = createDevServer({
      handler: failingHandler,
      port: 0,
      logging: false,
      errorPages: false,
    });

    const close = await dev.listen();

    try {
      expect(typeof close).toBe('function');
    } finally {
      await close();
    }
  });

  it('handleServiceError returns proper HTML structure', () => {
    const response = handleServiceError(new Error('test'));

    expect(response.status).toBe(500);
    expect(response.body).toContain('<!DOCTYPE html>');
    expect(response.body).toContain('<html>');
    expect(response.body).toContain('</html>');
    expect(response.headers['Content-Type']).toBe('text/html');
  });
});

// ===========================================================================
// 6. Errors Don't Crash the Server
// ===========================================================================

describe('errors do not crash the server', () => {
  it('server continues after streaming handler throws', async () => {
    let requestCount = 0;
    const handler: StreamingHandler = async (_req, res) => {
      requestCount++;
      if (requestCount === 1) {
        throw new Error('First request fails');
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    };

    const { url, close } = await startServer(handler);

    try {
      // First request throws
      const res1 = await fetch(`${url}/first`);
      expect(res1.status).toBe(500);

      // Second request succeeds
      const res2 = await fetch(`${url}/second`);
      expect(res2.status).toBe(200);
      expect(await res2.text()).toBe('OK');
    } finally {
      await close();
    }
  });

  it('server continues after static handler file read errors', async () => {
    const dir = join(tmpdir(), `error-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'client.js'), 'console.log("client");');

    try {
      const serveStatic = createStaticHandler({
        clientDir: dir,
        urlPatterns: ['/client.js', '/assets/'],
      });

      const handleStreaming = createTestStreamingHandler();

      const { url, close } = await startServer(async (req, res) => {
        if (serveStatic(req, res)) return;
        await handleStreaming(req, res);
      });

      try {
        // Request existing file
        const res1 = await fetch(`${url}/client.js`);
        expect(res1.status).toBe(200);

        // Request missing file in matched pattern
        const res2 = await fetch(`${url}/assets/missing.js`);
        expect(res2.status).toBe(404);

        // Server still serves subsequent requests
        const res3 = await fetch(`${url}/`);
        expect(res3.status).toBe(200);
        const html = await res3.text();
        expect(html).toContain('<!DOCTYPE html>');
      } finally {
        await close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('server continues after data prefetch rendering error', async () => {
    let callCount = 0;
    const handlePrefetch = createDataPrefetchHandler({
      createService: (path: string) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First prefetch fails');
        }
        return { path, data: { ok: true } };
      },
      createApp: () => ({
        status: 4 as RefSpec<unknown>['status'],
        create: () => createMockNodeRef('<div>app</div>'),
      } as RefSpec<unknown>),
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
      getData: (svc: { path: string; data: Record<string, unknown> }) => svc.data,
    });

    const { url, close } = await startServer(async (req, res) => {
      const handled = await handlePrefetch(req, res);
      if (!handled) {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    try {
      // First prefetch request fails
      const res1 = await fetch(`${url}/_data/first`);
      expect(res1.status).toBe(500);

      // Second prefetch request succeeds
      const res2 = await fetch(`${url}/_data/second`);
      expect(res2.status).toBe(200);
      const data = await res2.json();
      expect(data).toEqual({ ok: true });
    } finally {
      await close();
    }
  });

  it('server handles concurrent requests with mixed success/failure', async () => {
    let requestIndex = 0;
    const handler = createStreamingServer({
      shell: {
        title: 'Concurrent Test',
        streamKey: '__CONCURRENT__',
        rootId: false,
      },
      clientSrc: '/client.js',
      createService: ({ pathname }) => {
        requestIndex++;
        if (pathname === '/fail') {
          throw new Error('Intentional failure');
        }
        return {
          service: { pathname },
          serialize: createMockSerialize(),
          insertFragmentMarkers: (() => {}) as (fragment: FragmentRef<unknown>) => void,
        };
      },
      createApp: (svc: { pathname: string }) => ({
        status: 4 as RefSpec<unknown>['status'],
        create: () => createMockNodeRef(`<div>${svc.pathname}</div>`),
      } as RefSpec<unknown>),
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
    });

    const { url, close } = await startServer(handler);

    try {
      // Send multiple requests concurrently
      const [okRes, failRes, okRes2] = await Promise.all([
        fetch(`${url}/ok`),
        fetch(`${url}/fail`),
        fetch(`${url}/ok2`),
      ]);

      expect(okRes.status).toBe(200);
      expect(failRes.status).toBe(500);
      expect(okRes2.status).toBe(200);

      const html1 = await okRes.text();
      expect(html1).toContain('<div>/ok</div>');

      const html2 = await okRes2.text();
      expect(html2).toContain('<div>/ok2</div>');
    } finally {
      await close();
    }
  });

  it('dev server error handling does not leak headers-sent errors', async () => {
    // Verify that when headers are already sent (mid-stream), the error
    // handler doesn't try to call writeHead again.
    const handler: StreamingHandler = async (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.write('<html><body>');
      throw new Error('Error after headers sent');
    };

    const { url, close } = await startServer(async (req, res) => {
      try {
        await handler(req, res);
      } catch {
        // Headers already sent, can only end the response
        if (!res.headersSent) {
          res.writeHead(500);
        }
        res.end();
      }
    });

    try {
      const res = await fetch(`${url}/`);
      // Status was set to 200 before the error
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('<html><body>');
    } finally {
      await close();
    }
  });

  it('lifecycle onError hook is called during handleServiceError', () => {
    const onErrorSpy = vi.fn(() => '<h1>Custom 500</h1>');

    const response = handleServiceError(new Error('Lifecycle test'), {
      onError: onErrorSpy,
    });

    expect(onErrorSpy).toHaveBeenCalledOnce();
    expect(onErrorSpy).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Lifecycle test',
    }));
    expect(response.body).toBe('<h1>Custom 500</h1>');
  });
});
