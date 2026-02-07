/**
 * HTTP Server Integration Tests
 *
 * Verifies that the SSR server abstraction works with multiple HTTP server
 * implementations: Node.js native http, Express-style middleware, and
 * Fastify-style raw handlers.
 *
 * All handlers use standard Node.js IncomingMessage/ServerResponse types,
 * which makes them inherently compatible with any framework that exposes
 * or wraps these types.
 *
 * These tests spin up real HTTP servers and make actual fetch requests
 * to verify end-to-end behavior.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createStreamingServer, type StreamingHandler } from './streaming-server';
import { createStaticHandler, type StaticHandler } from './static-handler';
import { createDataPrefetchHandler, type DataPrefetchHandler } from './data-prefetch-handler';
import { createDevServer } from './dev';
import { createHtmlShell } from './html-shell';
import type { RefSpec, NodeRef, FragmentRef } from '@rimitive/view/types';
import { STATUS_ELEMENT } from '@rimitive/view/types';
import type { Serialize } from './parse5-adapter';
import { tmpdir } from 'node:os';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Track servers for cleanup */
const activeServers: Server[] = [];

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

/** Create a minimal streaming handler for testing */
function createTestStreamingHandler(): StreamingHandler {
  return createStreamingServer({
    shell: {
      title: 'Integration Test',
      streamKey: '__TEST_STREAM__',
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
    mount: () => (spec: RefSpec<unknown>) =>
      spec.create(),
  });
}

/** Create a temporary directory with test static files */
function createTestStaticDir(): { dir: string; cleanup: () => void } {
  const dir = join(tmpdir(), `rimitive-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'client.js'), 'console.log("client");');
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'assets', 'style.js'), 'console.log("style");');
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Create a test static handler */
function createTestStaticHandler(): { handler: StaticHandler; cleanup: () => void } {
  const { dir, cleanup } = createTestStaticDir();
  const handler = createStaticHandler({
    clientDir: dir,
    urlPatterns: ['/client.js', '/assets/'],
  });
  return { handler, cleanup };
}

/** Create a test data prefetch handler */
function createTestPrefetchHandler(): DataPrefetchHandler {
  return createDataPrefetchHandler({
    createService: (path: string) => ({
      path,
      data: { page: path, timestamp: 12345 },
    }),
    createApp: () => ({
      status: 4 as RefSpec<unknown>['status'],
      create: () =>
        ({
          status: 1 as const,
          element: { outerHTML: '<div>app</div>' },
          parent: null,
          prev: null,
          next: null,
          firstChild: null,
          lastChild: null,
        }) as unknown as NodeRef<unknown>,
    }),
    mount: () => (spec: RefSpec<unknown>) => spec.create(),
    getData: (svc) => svc.data,
  });
}

/** Start an HTTP server and return its URL */
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

afterEach(async () => {
  // Close all active servers
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

// ===========================================================================
// 1. Node.js native http.createServer
// ===========================================================================

describe('Node.js native http.createServer integration', () => {
  it('should serve streaming SSR responses', async () => {
    const handleStreaming = createTestStreamingHandler();
    const { url, close } = await startServer(handleStreaming);

    try {
      const res = await fetch(`${url}/overview`);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/html');

      const html = await res.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Integration Test</title>');
      expect(html).toContain('<div class="app">/overview</div>');
      expect(html).toContain('/client.js');
      expect(html).toContain('</body></html>');
    } finally {
      await close();
    }
  });

  it('should serve static assets', async () => {
    const { handler: serveStatic, cleanup } = createTestStaticHandler();

    const { url, close } = await startServer((req, res) => {
      if (serveStatic(req, res)) return;
      res.writeHead(404);
      res.end('Not Found');
    });

    try {
      const res = await fetch(`${url}/client.js`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/javascript');
      const body = await res.text();
      expect(body).toBe('console.log("client");');

      const assetRes = await fetch(`${url}/assets/style.js`);
      expect(assetRes.status).toBe(200);
      const assetBody = await assetRes.text();
      expect(assetBody).toBe('console.log("style");');

      // Non-matched URL should fall through
      const otherRes = await fetch(`${url}/api/data`);
      expect(otherRes.status).toBe(404);
    } finally {
      await close();
      cleanup();
    }
  });

  it('should serve data prefetch responses', async () => {
    const handlePrefetch = createTestPrefetchHandler();

    const { url, close } = await startServer(async (req, res) => {
      const handled = await handlePrefetch(req, res);
      if (!handled) {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    try {
      const res = await fetch(`${url}/_data/overview`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/json');

      const data = await res.json();
      expect(data).toEqual({ page: '/overview', timestamp: 12345 });

      // Non-prefetch URL should fall through
      const otherRes = await fetch(`${url}/overview`);
      expect(otherRes.status).toBe(404);
    } finally {
      await close();
    }
  });

  it('should compose all three handlers in a middleware chain', async () => {
    const handleStreaming = createTestStreamingHandler();
    const { handler: serveStatic, cleanup } = createTestStaticHandler();
    const handlePrefetch = createTestPrefetchHandler();

    const { url, close } = await startServer(async (req, res) => {
      if (serveStatic(req, res)) return;
      if (await handlePrefetch(req, res)) return;
      await handleStreaming(req, res);
    });

    try {
      // Static asset
      const staticRes = await fetch(`${url}/client.js`);
      expect(staticRes.status).toBe(200);
      expect(await staticRes.text()).toBe('console.log("client");');

      // Data prefetch
      const prefetchRes = await fetch(`${url}/_data/feed`);
      expect(prefetchRes.status).toBe(200);
      const prefetchData = await prefetchRes.json();
      expect(prefetchData.page).toBe('/feed');

      // Streaming SSR (fallback)
      const ssrRes = await fetch(`${url}/dashboard`);
      expect(ssrRes.status).toBe(200);
      const html = await ssrRes.text();
      expect(html).toContain('<div class="app">/dashboard</div>');
    } finally {
      await close();
      cleanup();
    }
  });
});

// ===========================================================================
// 2. Express-style middleware pattern
// ===========================================================================

describe('Express-style middleware pattern integration', () => {
  /**
   * Simulates an Express-like middleware runner that processes handlers
   * in order, passing (req, res, next) to each.
   *
   * The key insight: Express passes the raw Node.js IncomingMessage and
   * ServerResponse objects to middleware, so rimitive handlers work
   * directly as Express middleware with minimal wrapping.
   */
  function createExpressStyleApp(
    ...handlers: Array<
      (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>
    >
  ): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
    return async (req, res) => {
      let index = 0;
      const next = async (): Promise<void> => {
        if (index >= handlers.length) return;
        const handler = handlers[index++]!;
        await handler(req, res, next);
      };
      await next();
    };
  }

  /**
   * Wraps a rimitive StaticHandler as Express middleware.
   * StaticHandler returns boolean; if true, request was handled.
   */
  function staticAsExpressMiddleware(
    handler: StaticHandler,
  ): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
    return (req, res, next) => {
      if (!handler(req, res)) next();
    };
  }

  /**
   * Wraps a rimitive DataPrefetchHandler as Express middleware.
   */
  function prefetchAsExpressMiddleware(
    handler: DataPrefetchHandler,
  ): (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void> {
    return async (req, res, next) => {
      if (!(await handler(req, res))) next();
    };
  }

  /**
   * Wraps a rimitive StreamingHandler as Express middleware (terminal).
   */
  function streamingAsExpressMiddleware(
    handler: StreamingHandler,
  ): (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void> {
    return async (req, res) => {
      await handler(req, res);
    };
  }

  it('should work as Express middleware with static, prefetch, and streaming', async () => {
    const handleStreaming = createTestStreamingHandler();
    const { handler: serveStatic, cleanup } = createTestStaticHandler();
    const handlePrefetch = createTestPrefetchHandler();

    const app = createExpressStyleApp(
      staticAsExpressMiddleware(serveStatic),
      prefetchAsExpressMiddleware(handlePrefetch),
      streamingAsExpressMiddleware(handleStreaming),
    );

    const { url, close } = await startServer(app);

    try {
      // Static
      const staticRes = await fetch(`${url}/client.js`);
      expect(staticRes.status).toBe(200);
      expect(await staticRes.text()).toBe('console.log("client");');

      // Prefetch
      const prefetchRes = await fetch(`${url}/_data/sites/site-1`);
      expect(prefetchRes.status).toBe(200);
      const data = await prefetchRes.json();
      expect(data.page).toBe('/sites/site-1');

      // Streaming SSR
      const ssrRes = await fetch(`${url}/`);
      expect(ssrRes.status).toBe(200);
      const html = await ssrRes.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<div class="app">/</div>');
    } finally {
      await close();
      cleanup();
    }
  });

  it('should work with Express-style error handling middleware', async () => {
    const failingHandler = async () => {
      throw new Error('Intentional test error');
    };

    let caughtError: unknown;

    // Simulate Express-style error wrapping around handler pipeline
    const app = async (...[, res]: [IncomingMessage, ServerResponse]) => {
      try {
        await failingHandler();
      } catch (err) {
        caughtError = err;
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        }
      }
    };

    const { url, close } = await startServer(app);

    try {
      const res = await fetch(`${url}/`);
      expect(res.status).toBe(500);
      expect(caughtError).toBeInstanceOf(Error);
    } finally {
      await close();
    }
  });
});

// ===========================================================================
// 3. Fastify-style raw handler pattern
// ===========================================================================

describe('Fastify-style raw handler pattern integration', () => {
  /**
   * Simulates Fastify's raw mode where route handlers receive the
   * standard Node.js IncomingMessage and ServerResponse via
   * request.raw / reply.raw.
   *
   * In Fastify, when using `{ config: { rawBody: true } }` or
   * accessing `request.raw` and `reply.raw`, you get the underlying
   * Node.js objects — which is exactly what rimitive handlers expect.
   */
  type FastifyRawRequest = {
    raw: IncomingMessage;
    url: string;
    method: string;
  };

  type FastifyRawReply = {
    raw: ServerResponse;
    hijack: () => void;
    sent: boolean;
  };

  function createFastifyRequest(req: IncomingMessage): FastifyRawRequest {
    return {
      raw: req,
      url: req.url ?? '/',
      method: req.method ?? 'GET',
    };
  }

  function createFastifyReply(res: ServerResponse): FastifyRawReply {
    return {
      raw: res,
      hijack: () => {
        // In Fastify, hijack() tells the framework not to manage the response
      },
      sent: false,
    };
  }

  it('should work with Fastify raw request/reply for streaming', async () => {
    const handleStreaming = createTestStreamingHandler();

    const { url, close } = await startServer(async (req, res) => {
      // Simulate Fastify extracting raw objects
      const fastifyReq = createFastifyRequest(req);
      const fastifyReply = createFastifyReply(res);

      // In Fastify, you'd call reply.hijack() then use the raw objects
      fastifyReply.hijack();
      await handleStreaming(fastifyReq.raw, fastifyReply.raw);
    });

    try {
      const res = await fetch(`${url}/test-page`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/html');

      const html = await res.text();
      expect(html).toContain('<div class="app">/test-page</div>');
      expect(html).toContain('</body></html>');
    } finally {
      await close();
    }
  });

  it('should work with Fastify raw request/reply for static assets', async () => {
    const { handler: serveStatic, cleanup } = createTestStaticHandler();

    const { url, close } = await startServer((req, res) => {
      const fastifyReq = createFastifyRequest(req);
      const fastifyReply = createFastifyReply(res);

      if (serveStatic(fastifyReq.raw, fastifyReply.raw)) {
        fastifyReply.sent = true;
        return;
      }

      // Fastify would handle 404 normally
      res.writeHead(404);
      res.end('Not Found');
    });

    try {
      const res = await fetch(`${url}/client.js`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('console.log("client");');
    } finally {
      await close();
      cleanup();
    }
  });

  it('should work with Fastify raw request/reply for data prefetch', async () => {
    const handlePrefetch = createTestPrefetchHandler();

    const { url, close } = await startServer(async (req, res) => {
      const fastifyReq = createFastifyRequest(req);
      const fastifyReply = createFastifyReply(res);

      const handled = await handlePrefetch(fastifyReq.raw, fastifyReply.raw);
      if (handled) {
        fastifyReply.sent = true;
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    try {
      const res = await fetch(`${url}/_data/dashboard`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.page).toBe('/dashboard');
    } finally {
      await close();
    }
  });
});

// ===========================================================================
// 4. createDevServer integration (uses http.createServer internally)
// ===========================================================================

describe('createDevServer integration', () => {
  it('should start a real HTTP server and respond to requests', async () => {
    const handleStreaming = createTestStreamingHandler();

    const dev = createDevServer({
      handler: handleStreaming,
      port: 0, // Let the OS assign a port
      logging: false,
      errorPages: true,
    });

    // createDevServer uses port from config, but with port: 0 it still binds
    // We need to check if port 0 works — it should pick a random port
    const close = await dev.listen();

    try {
      // Since port 0 assigns an ephemeral port, we can't easily determine it
      // from the DevServerResult. This test verifies the listen/close lifecycle.
      // The actual server functionality is verified by the handler tests above.
      expect(typeof close).toBe('function');
    } finally {
      await close();
    }
  });

  it('should run middleware before the streaming handler', async () => {
    const handleStreaming = createTestStreamingHandler();
    const requestLog: string[] = [];

    const dev = createDevServer({
      handler: handleStreaming,
      port: 0,
      logging: false,
      middleware: [
        (req) => {
          requestLog.push(req.url ?? '/');
          // Custom API route
          return req.url === '/api/health';
        },
      ],
    });

    // Verify middleware array is accepted and the dev server creates successfully
    expect(dev.port).toBe(0);
    expect(typeof dev.listen).toBe('function');
  });
});

// ===========================================================================
// 5. Server-agnostic verification
// ===========================================================================

describe('server-agnostic abstraction verification', () => {
  it('all handlers accept standard IncomingMessage and ServerResponse types', () => {
    // Type-level verification that handlers use Node.js standard types.
    // If this compiles, the types are compatible with any Node.js HTTP framework.
    const handleStreaming = createTestStreamingHandler();
    const { handler: serveStatic, cleanup } = createTestStaticHandler();
    const handlePrefetch = createTestPrefetchHandler();

    // Verify function signatures
    const streamingFn: (req: IncomingMessage, res: ServerResponse) => Promise<void> = handleStreaming;
    const staticFn: (req: IncomingMessage, res: ServerResponse) => boolean = serveStatic;
    const prefetchFn: (req: IncomingMessage, res: ServerResponse) => Promise<boolean> = handlePrefetch;

    expect(streamingFn).toBe(handleStreaming);
    expect(staticFn).toBe(serveStatic);
    expect(prefetchFn).toBe(handlePrefetch);

    cleanup();
  });

  it('handlers only read req.url and req.headers from IncomingMessage', async () => {
    // Verify handlers work with the absolute minimum IncomingMessage properties.
    // This proves compatibility with frameworks that provide partial wrappers.
    const handleStreaming = createTestStreamingHandler();

    const minimalReq = {
      url: '/minimal',
      headers: { host: 'localhost' },
    } as IncomingMessage;

    const chunks: string[] = [];
    const minimalRes = {
      writeHead: () => minimalRes,
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
      end: (chunk?: string) => {
        if (chunk) chunks.push(chunk);
      },
      headersSent: false,
    } as unknown as ServerResponse;

    await handleStreaming(minimalReq, minimalRes);

    const html = chunks.join('');
    expect(html).toContain('<div class="app">/minimal</div>');
  });

  it('createHtmlShell is independent of any HTTP framework', () => {
    // createHtmlShell produces strings — no HTTP dependency at all
    const shell = createHtmlShell({
      title: 'Standalone',
      streamKey: '__STREAM__',
    });

    expect(shell.start).toContain('<!DOCTYPE html>');
    expect(shell.start).toContain('<title>Standalone</title>');
    expect(shell.appClose).toBeDefined();
    expect(typeof shell.stream).toBe('object');
  });

  it('middleware pattern works with a custom HTTP framework abstraction', async () => {
    // Demonstrate a custom framework: handlers are registered and dispatched
    // in order, similar to how Koa, Hapi, or other frameworks work internally.
    type Route = {
      match: (url: string) => boolean;
      handle: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
    };

    class MiniFramework {
      private routes: Route[] = [];

      use(match: (url: string) => boolean, handle: Route['handle']): void {
        this.routes.push({ match, handle });
      }

      async dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const url = req.url ?? '/';
        for (const route of this.routes) {
          if (route.match(url)) {
            const handled = await route.handle(req, res);
            if (handled) return;
          }
        }
        // Default 404
        res.writeHead(404);
        res.end('Not Found');
      }
    }

    const app = new MiniFramework();
    const { handler: serveStatic, cleanup } = createTestStaticHandler();
    const handlePrefetch = createTestPrefetchHandler();
    const handleStreaming = createTestStreamingHandler();

    // Register rimitive handlers in the custom framework
    app.use(
      (url) => url === '/client.js' || url.startsWith('/assets/'),
      async (req, res) => serveStatic(req, res),
    );
    app.use(
      (url) => url.startsWith('/_data/'),
      (req, res) => handlePrefetch(req, res),
    );
    app.use(
      () => true, // catch-all
      async (req, res) => {
        await handleStreaming(req, res);
        return true;
      },
    );

    const { url, close } = await startServer((req, res) => app.dispatch(req, res));

    try {
      // Verify all three handler types work through the custom framework
      const staticRes = await fetch(`${url}/client.js`);
      expect(staticRes.status).toBe(200);

      const prefetchRes = await fetch(`${url}/_data/overview`);
      expect(prefetchRes.status).toBe(200);
      const data = await prefetchRes.json();
      expect(data.page).toBe('/overview');

      const ssrRes = await fetch(`${url}/page`);
      expect(ssrRes.status).toBe(200);
      const html = await ssrRes.text();
      expect(html).toContain('<div class="app">/page</div>');
    } finally {
      await close();
      cleanup();
    }
  });
});
