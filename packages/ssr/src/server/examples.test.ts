/**
 * Tests for README usage example patterns.
 *
 * Verifies that the compositional patterns documented in README.md
 * work correctly: handler composition, dev server middleware pipeline,
 * service factory with custom modules, request logging integration,
 * and SSR lifecycle logging.
 */

import { describe, it, expect, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createStreamingServer } from './streaming-server';
import { createStaticHandler } from './static-handler';
import { createDataPrefetchHandler } from './data-prefetch-handler';
import { createDevServer } from './dev';
import {
  createServiceFactory,
  createConfiguredServiceFactory,
  createRequestScope,
  handleServiceError,
} from './create-service-factory';
import { createHtmlShell } from './html-shell';
import { createRequestLogger } from './dev';
import { createLogger } from './logging';
import { generateChunkScript } from './stream-writer';
import { STATUS_ELEMENT } from '@rimitive/view/types';
import type { RefSpec, NodeRef, FragmentRef } from '@rimitive/view/types';
import type { Serialize } from './parse5-adapter';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockReq(url: string): IncomingMessage {
  return {
    url,
    method: 'GET',
    headers: { host: 'localhost:3000' },
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

// ---------------------------------------------------------------------------
// Example 1: Minimal Server Setup
// ---------------------------------------------------------------------------

describe('Example: Minimal server setup', () => {
  it('should create a streaming handler with minimal config', async () => {
    const handler = createStreamingServer({
      shell: {
        title: 'My App',
        streamKey: '__APP_STREAM__',
        rootId: false,
      },
      clientSrc: '/client.js',
      createService: ({ pathname }) => ({
        service: { pathname },
        serialize: createMockSerialize(),
        insertFragmentMarkers: (() => {}) as (fragment: FragmentRef<unknown>) => void,
      }),
      createApp: (svc: { pathname: string }) =>
        ({
          status: 4,
          create: () => createMockNodeRef(`<h1>${svc.pathname}</h1>`),
        }) as unknown as RefSpec<unknown>,
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
    });

    const req = createMockReq('/');
    const res = createMockRes();
    await handler(req, res);

    const output = res._written.join('');
    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('<title>My App</title>');
    expect(output).toContain('/client.js');
    expect(output).toContain('</body></html>');
    expect(res._ended).toBe(true);
  });

  it('should handle different paths', async () => {
    let capturedPathname = '';

    const handler = createStreamingServer({
      shell: { title: 'Test', streamKey: '__S__', rootId: false },
      clientSrc: '/client.js',
      createService: ({ pathname }) => {
        capturedPathname = pathname;
        return {
          service: {},
          serialize: createMockSerialize(),
          insertFragmentMarkers: (() => {}) as (fragment: FragmentRef<unknown>) => void,
        };
      },
      createApp: () =>
        ({
          status: 4,
          create: () => createMockNodeRef('<div>app</div>'),
        }) as unknown as RefSpec<unknown>,
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
    });

    await handler(createMockReq('/about'), createMockRes());
    expect(capturedPathname).toBe('/about');
  });
});

// ---------------------------------------------------------------------------
// Example 2: Server with Custom API Routes
// ---------------------------------------------------------------------------

describe('Example: Server with custom API routes', () => {
  function handleApiRoutes(req: IncomingMessage, res: ServerResponse): boolean {
    const url = req.url ?? '/';

    if (url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return true;
    }

    if (url.startsWith('/api/users')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ users: [] }));
      return true;
    }

    return false;
  }

  it('should handle API health route', () => {
    const req = createMockReq('/api/health');
    const res = createMockRes();
    const handled = handleApiRoutes(req, res);

    expect(handled).toBe(true);
    expect(res._headers['Content-Type']).toBe('application/json');
    expect(res._written.join('')).toContain('"status":"ok"');
  });

  it('should handle API users route', () => {
    const req = createMockReq('/api/users');
    const res = createMockRes();
    const handled = handleApiRoutes(req, res);

    expect(handled).toBe(true);
    expect(res._written.join('')).toContain('"users":[]');
  });

  it('should pass through non-API routes', () => {
    const req = createMockReq('/about');
    const res = createMockRes();
    const handled = handleApiRoutes(req, res);

    expect(handled).toBe(false);
  });

  it('should compose API routes with handler chain', async () => {
    const serveStatic = createStaticHandler({
      clientDir: '/tmp/nonexistent-client-dir-test',
      urlPatterns: ['/client.js'],
    });

    const handleStreaming = createStreamingServer({
      shell: { title: 'Test', streamKey: '__S__', rootId: false },
      clientSrc: '/client.js',
      createService: () => ({
        service: {},
        serialize: createMockSerialize(),
        insertFragmentMarkers: (() => {}) as (fragment: FragmentRef<unknown>) => void,
      }),
      createApp: () =>
        ({
          status: 4,
          create: () => createMockNodeRef('<div>app</div>'),
        }) as unknown as RefSpec<unknown>,
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
    });

    // Simulate the handler chain from the example
    async function handleRequest(req: IncomingMessage, res: ServerResponse) {
      if (serveStatic(req, res)) return;
      if (handleApiRoutes(req, res)) return;
      await handleStreaming(req, res);
    }

    // API route handled first
    const apiReq = createMockReq('/api/health');
    const apiRes = createMockRes();
    await handleRequest(apiReq, apiRes);
    expect(apiRes._written.join('')).toContain('"status":"ok"');

    // Non-API falls through to streaming
    const pageReq = createMockReq('/about');
    const pageRes = createMockRes();
    await handleRequest(pageReq, pageRes);
    expect(pageRes._written.join('')).toContain('<!DOCTYPE html>');
  });
});

// ---------------------------------------------------------------------------
// Example 3: Server with Middleware (createDevServer)
// ---------------------------------------------------------------------------

describe('Example: Server with middleware', () => {
  it('should create a dev server with middleware pipeline', () => {
    const handleStreaming = createStreamingServer({
      shell: { title: 'Test', streamKey: '__S__', rootId: false },
      clientSrc: '/client.js',
      createService: () => ({
        service: {},
        serialize: createMockSerialize(),
        insertFragmentMarkers: (() => {}) as (fragment: FragmentRef<unknown>) => void,
      }),
      createApp: () =>
        ({
          status: 4,
          create: () => createMockNodeRef('<div>app</div>'),
        }) as unknown as RefSpec<unknown>,
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
    });

    const serveStatic = createStaticHandler({
      clientDir: '/tmp/nonexistent-client-dir-test',
      urlPatterns: ['/client.js'],
    });

    const dev = createDevServer({
      handler: handleStreaming,
      port: 0,
      middleware: [
        (req, res) => serveStatic(req, res),
      ],
      logging: { exclude: ['/assets/'] },
      errorPages: true,
      onReady: () => {},
    });

    expect(dev.port).toBe(0);
    expect(typeof dev.listen).toBe('function');
  });

  it('should start and stop dev server', async () => {
    const handleStreaming = createStreamingServer({
      shell: { title: 'Test', streamKey: '__S__', rootId: false },
      clientSrc: '/client.js',
      createService: () => ({
        service: {},
        serialize: createMockSerialize(),
        insertFragmentMarkers: (() => {}) as (fragment: FragmentRef<unknown>) => void,
      }),
      createApp: () =>
        ({
          status: 4,
          create: () => createMockNodeRef('<div>app</div>'),
        }) as unknown as RefSpec<unknown>,
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
    });

    const readyFn = vi.fn();
    const dev = createDevServer({
      handler: handleStreaming,
      port: 0, // OS assigns a free port
      onReady: readyFn,
      logging: false,
    });

    const close = await dev.listen();
    expect(readyFn).toHaveBeenCalled();
    await close();
  });
});

// ---------------------------------------------------------------------------
// Example 4: Server with Custom Service Modules
// ---------------------------------------------------------------------------

describe('Example: Server with custom service modules', () => {
  it('should create factory with lifecycle hooks', () => {
    const onCreateFn = vi.fn();
    const onDestroyFn = vi.fn();

    const factory = createServiceFactory({
      lifecycle: {
        onCreate: onCreateFn,
        onDestroy: onDestroyFn,
      },
    });

    const { service, adapterResult } = factory();
    expect(service).toBeDefined();
    expect(adapterResult.serialize).toBeDefined();
    expect(adapterResult.insertFragmentMarkers).toBeDefined();
    expect(onCreateFn).toHaveBeenCalledOnce();
  });

  it('should create configured factory with adapter-dependent modules', () => {
    const factory = createConfiguredServiceFactory({
      modules: () => [],
    });

    const { service, adapterResult } = factory();
    expect(service).toBeDefined();
    expect(adapterResult).toBeDefined();
  });

  it('should create request scope with dispose', () => {
    const factory = createServiceFactory();
    const scope = createRequestScope(factory);

    expect(scope.service).toBeDefined();
    expect(scope.adapterResult).toBeDefined();
    expect(typeof scope.dispose).toBe('function');

    // Dispose is idempotent
    scope.dispose();
    scope.dispose();
  });

  it('should generate HTML shell with streaming support', () => {
    const shell = createHtmlShell({
      title: 'Custom Modules App',
      streamKey: '__APP__',
    });

    expect(shell.start).toContain('<!DOCTYPE html>');
    expect(shell.start).toContain('Custom Modules App');
    expect(shell.stream).toBeDefined();
    expect(shell.appClose).toBeDefined();
    expect(typeof shell.end).toBe('function');
  });

  it('should generate chunk scripts from shell stream', () => {
    const shell = createHtmlShell({
      title: 'Test',
      streamKey: '__APP__',
    });

    const chunkScript = generateChunkScript(shell.stream!, 'user-data', { name: 'Alice' });
    expect(chunkScript).toContain('<script>');
    expect(chunkScript).toContain('__APP__');
    expect(chunkScript).toContain('user-data');
    expect(chunkScript).toContain('Alice');
  });

  it('should handle service errors with default response', () => {
    const { status, body, headers } = handleServiceError(new Error('test'));

    expect(status).toBe(500);
    expect(body).toContain('Server Error');
    expect(headers['Content-Type']).toBe('text/html');
  });

  it('should handle service errors with custom handler', () => {
    const { status, body } = handleServiceError(new Error('oops'), {
      onError: (err) => `<p>${err instanceof Error ? err.message : String(err)}</p>`,
    });

    expect(status).toBe(500);
    expect(body).toBe('<p>oops</p>');
  });
});

// ---------------------------------------------------------------------------
// Example 5: Express Integration Pattern
// ---------------------------------------------------------------------------

describe('Example: Express integration pattern', () => {
  it('should wrap static handler as Express middleware', () => {
    const serveStatic = createStaticHandler({
      clientDir: '/tmp/nonexistent-client-dir-test',
      urlPatterns: ['/client.js', '/assets/'],
    });

    // Simulates Express's (req, res, next) pattern
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    const req = createMockReq('/about');
    const res = createMockRes();

    // Pattern from the Express example
    if (!serveStatic(req, res)) {
      next();
    }

    expect(nextCalled).toBe(true);
  });

  it('should wrap prefetch handler as Express async middleware', async () => {
    const handlePrefetch = createDataPrefetchHandler({
      createService: () => ({ getData: () => ({}) }),
      createApp: () =>
        ({
          status: 4,
          create: () => createMockNodeRef('<div>app</div>'),
        }) as unknown as RefSpec<unknown>,
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
      getData: (svc: { getData: () => Record<string, unknown> }) => svc.getData(),
    });

    let nextCalled = false;
    const next = () => { nextCalled = true; };

    const req = createMockReq('/about');
    const res = createMockRes();

    // Pattern from the Express example
    if (!(await handlePrefetch(req, res))) {
      next();
    }

    expect(nextCalled).toBe(true);
  });

  it('should serve prefetch data through Express-style handler', async () => {
    const handlePrefetch = createDataPrefetchHandler({
      createService: () => ({ getData: () => ({ users: [{ id: 1 }] }) }),
      createApp: () =>
        ({
          status: 4,
          create: () => createMockNodeRef('<div>app</div>'),
        }) as unknown as RefSpec<unknown>,
      mount: () => (spec: RefSpec<unknown>) => spec.create(),
      getData: (svc: { getData: () => Record<string, unknown> }) => svc.getData(),
    });

    const req = createMockReq('/_data/users');
    const res = createMockRes();
    const handled = await handlePrefetch(req, res);

    expect(handled).toBe(true);
    expect(res._headers['Content-Type']).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// Example 6: Production Configuration with Logging
// ---------------------------------------------------------------------------

describe('Example: Production configuration with logging', () => {
  it('should create SSR lifecycle logger with custom output', () => {
    const entries: Array<{ level: string; event: string; message: string }> = [];

    const ssrLogger = createLogger({
      level: 'info',
      output: (entry) => {
        entries.push({
          level: entry.level,
          event: entry.event.type,
          message: entry.message,
        });
      },
    });

    const reqLog = ssrLogger.request('/dashboard');
    reqLog.renderStart();
    reqLog.renderComplete(2);
    reqLog.streamComplete();

    expect(entries.length).toBe(3);
    expect(entries[0]!.event).toBe('render-start');
    expect(entries[1]!.event).toBe('render-complete');
    expect(entries[1]!.message).toContain('2 pending boundaries');
    expect(entries[2]!.event).toBe('stream-complete');
  });

  it('should filter log levels correctly', () => {
    const entries: string[] = [];

    const ssrLogger = createLogger({
      level: 'info',
      output: (entry) => {
        entries.push(entry.event.type);
      },
    });

    const reqLog = ssrLogger.request('/');
    reqLog.serviceCreated(); // debug — should be filtered
    reqLog.renderStart();    // info — should pass
    reqLog.chunkSent('a');   // debug — should be filtered
    reqLog.streamComplete(); // info — should pass

    expect(entries).toEqual(['render-start', 'stream-complete']);
  });

  it('should create request logger with exclusions', async () => {
    const entries: Array<{ url: string; status: number }> = [];

    const logRequest = createRequestLogger({
      exclude: ['/assets/', '/favicon.ico'],
      log: (entry) => {
        entries.push({ url: entry.url, status: entry.status });
      },
    });

    // Non-excluded request
    const req1 = createMockReq('/about');
    const res1 = createMockRes();
    await logRequest(req1, res1, async () => {
      res1.writeHead(200);
      res1.end('ok');
    });

    // Excluded request (prefix match)
    const req2 = createMockReq('/assets/style.css');
    const res2 = createMockRes();
    await logRequest(req2, res2, async () => {
      res2.writeHead(200);
      res2.end('css');
    });

    // Excluded request (exact match)
    const req3 = createMockReq('/favicon.ico');
    const res3 = createMockRes();
    await logRequest(req3, res3, async () => {
      res3.writeHead(200);
      res3.end('icon');
    });

    expect(entries.length).toBe(1);
    expect(entries[0]!.url).toBe('/about');
  });

  it('should integrate logging with onResolve for chunk tracking', () => {
    const events: string[] = [];

    const ssrLogger = createLogger({
      level: 'debug',
      output: (entry) => {
        events.push(entry.event.type);
      },
    });

    const reqLog = ssrLogger.request('/dashboard');
    reqLog.serviceCreated();
    reqLog.renderStart();

    // Simulate what happens in the production example's onResolve wrapper
    const wrappedOnResolve = (id: string, _data: unknown) => {
      reqLog.chunkSent(id);
    };

    wrappedOnResolve('user-profile', { name: 'Alice' });
    wrappedOnResolve('stats', { views: 100 });

    reqLog.renderComplete(2);
    reqLog.streamComplete();
    reqLog.serviceDisposed();

    expect(events).toEqual([
      'service-created',
      'render-start',
      'chunk-sent',
      'chunk-sent',
      'render-complete',
      'stream-complete',
      'service-disposed',
    ]);
  });

  it('should handle errors with handleServiceError in production', () => {
    const { status, body, headers } = handleServiceError(
      new Error('Database connection failed'),
    );

    expect(status).toBe(500);
    expect(body).toContain('500');
    expect(headers['Content-Type']).toBe('text/html');
  });
});
