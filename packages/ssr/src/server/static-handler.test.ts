/**
 * Tests for static file handler
 *
 * Unit tests cover pattern matching, MIME types, and 404 handling.
 * Integration tests verify middleware chain behavior with real file assets,
 * nested directories, and the pass-through pattern used in the actual server.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStaticHandler } from './static-handler';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function createMockReq(url: string): IncomingMessage {
  return { url } as IncomingMessage;
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

describe('createStaticHandler', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `static-handler-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(join(tempDir, 'assets'), { recursive: true });
    writeFileSync(join(tempDir, 'client.js'), 'console.log("client")');
    writeFileSync(join(tempDir, 'assets', 'chunk.js'), 'console.log("chunk")');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should serve client.js when matched', () => {
    const handler = createStaticHandler({
      clientDir: tempDir,
      urlPatterns: ['/client.js', '/assets/'],
    });
    const req = createMockReq('/client.js');
    const res = createMockRes();

    const handled = handler(req, res);

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('application/javascript');
    expect(res._body).toBe('console.log("client")');
  });

  it('should serve files from prefix-matched directories', () => {
    const handler = createStaticHandler({
      clientDir: tempDir,
      urlPatterns: ['/client.js', '/assets/'],
    });
    const req = createMockReq('/assets/chunk.js');
    const res = createMockRes();

    const handled = handler(req, res);

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._body).toBe('console.log("chunk")');
  });

  it('should return false for unmatched URLs', () => {
    const handler = createStaticHandler({
      clientDir: tempDir,
      urlPatterns: ['/client.js', '/assets/'],
    });
    const req = createMockReq('/api/data');
    const res = createMockRes();

    const handled = handler(req, res);

    expect(handled).toBe(false);
    expect(res._status).toBe(0);
  });

  it('should return 404 for matched patterns with non-existent files', () => {
    const handler = createStaticHandler({
      clientDir: tempDir,
      urlPatterns: ['/client.js', '/assets/'],
    });
    const req = createMockReq('/assets/nonexistent.js');
    const res = createMockRes();

    const handled = handler(req, res);

    expect(handled).toBe(true);
    expect(res._status).toBe(404);
    expect(res._body).toBe('Not found');
  });

  it('should return false when req.url is undefined', () => {
    const handler = createStaticHandler({
      clientDir: tempDir,
      urlPatterns: ['/client.js'],
    });
    const req = createMockReq(undefined as unknown as string);
    const res = createMockRes();

    const handled = handler(req, res);

    expect(handled).toBe(false);
  });

  it('should support exact match patterns', () => {
    const handler = createStaticHandler({
      clientDir: tempDir,
      urlPatterns: ['/client.js'],
    });

    // Exact match works
    expect(handler(createMockReq('/client.js'), createMockRes())).toBe(true);

    // Non-matching does not
    expect(handler(createMockReq('/client.js.bak'), createMockRes())).toBe(false);
  });

  it('should support prefix match patterns ending with /', () => {
    const handler = createStaticHandler({
      clientDir: tempDir,
      urlPatterns: ['/assets/'],
    });

    // Prefix match works
    expect(handler(createMockReq('/assets/chunk.js'), createMockRes())).toBe(true);

    // Non-prefix does not
    expect(handler(createMockReq('/other/file.js'), createMockRes())).toBe(false);
  });
});

/**
 * Integration tests for static asset serving in the middleware chain.
 *
 * These tests verify that createStaticHandler works correctly in
 * the server pipeline pattern used by the example server:
 *
 *   if (serveStatic(req, res)) return;
 *   if (await handlePrefetch(req, res)) return;
 *   await handleStreaming(req, res);
 *
 * Tests cover:
 * - client.js bundle serving with correct content
 * - /assets/*.js chunk serving for lazy-loaded modules
 * - Correct MIME types (application/javascript)
 * - 404 handling for non-existent assets
 * - Middleware pass-through for non-static URLs
 * - Nested asset directories
 */
describe('createStaticHandler — integration', () => {
  let clientDir: string;

  beforeEach(() => {
    clientDir = join(tmpdir(), `static-integration-test-${Date.now()}`);
    mkdirSync(clientDir, { recursive: true });
    mkdirSync(join(clientDir, 'assets'), { recursive: true });
    mkdirSync(join(clientDir, 'assets', 'lazy'), { recursive: true });

    // Simulate a real client build output
    writeFileSync(
      join(clientDir, 'client.js'),
      'import{signal}from"@rimitive/signals";const app=()=>signal(0);export{app};',
    );
    writeFileSync(
      join(clientDir, 'assets', 'overview-DfK2x.js'),
      'export const OverviewPage=()=>"overview";',
    );
    writeFileSync(
      join(clientDir, 'assets', 'feed-aB3cD.js'),
      'export const FeedPage=()=>"feed";',
    );
    writeFileSync(
      join(clientDir, 'assets', 'lazy', 'chart-xY9z.js'),
      'export const Chart=()=>"chart";',
    );
  });

  afterEach(() => {
    rmSync(clientDir, { recursive: true, force: true });
  });

  function createServerPipeline() {
    const serveStatic = createStaticHandler({
      clientDir,
      urlPatterns: ['/client.js', '/assets/'],
    });

    let fallbackCalled = false;

    /** Simulates the server's request handling pipeline */
    function handleRequest(url: string) {
      const req = createMockReq(url);
      const res = createMockRes();
      const handled = serveStatic(req, res);
      if (!handled) fallbackCalled = true;
      return { res, handled, fallbackCalled };
    }

    return { handleRequest, getFallbackCalled: () => fallbackCalled };
  }

  it('should serve client.js with bundled client code', () => {
    const { handleRequest } = createServerPipeline();
    const { res, handled } = handleRequest('/client.js');

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('application/javascript');
    expect(res._body).toContain('signal');
    expect(res._body).toContain('export');
  });

  it('should serve /assets/*.js lazy-loaded chunks', () => {
    const { handleRequest } = createServerPipeline();

    const overview = handleRequest('/assets/overview-DfK2x.js');
    expect(overview.handled).toBe(true);
    expect(overview.res._status).toBe(200);
    expect(overview.res._headers['Content-Type']).toBe('application/javascript');
    expect(overview.res._body).toContain('OverviewPage');

    const feed = handleRequest('/assets/feed-aB3cD.js');
    expect(feed.handled).toBe(true);
    expect(feed.res._status).toBe(200);
    expect(feed.res._body).toContain('FeedPage');
  });

  it('should serve assets from nested subdirectories', () => {
    const { handleRequest } = createServerPipeline();
    const { res, handled } = handleRequest('/assets/lazy/chart-xY9z.js');

    expect(handled).toBe(true);
    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('application/javascript');
    expect(res._body).toContain('Chart');
  });

  it('should return 404 for non-existent assets within matched patterns', () => {
    const { handleRequest } = createServerPipeline();
    const { res, handled } = handleRequest('/assets/deleted-chunk-abc.js');

    expect(handled).toBe(true);
    expect(res._status).toBe(404);
    expect(res._body).toBe('Not found');
  });

  it('should pass through non-static URLs to the next handler', () => {
    const { handleRequest } = createServerPipeline();

    // Page routes should fall through
    const home = handleRequest('/');
    expect(home.handled).toBe(false);
    expect(home.res._status).toBe(0);

    const sitePage = handleRequest('/sites/site-1');
    expect(sitePage.handled).toBe(false);

    // Data prefetch routes should fall through
    const prefetch = handleRequest('/_data/overview');
    expect(prefetch.handled).toBe(false);

    // API routes should fall through
    const api = handleRequest('/api/sites');
    expect(api.handled).toBe(false);
  });

  it('should serve all assets for a typical page load sequence', () => {
    const { handleRequest } = createServerPipeline();

    // 1. Initial page request falls through to streaming handler
    const page = handleRequest('/');
    expect(page.handled).toBe(false);

    // 2. Client bundle request is intercepted
    const bundle = handleRequest('/client.js');
    expect(bundle.handled).toBe(true);
    expect(bundle.res._status).toBe(200);

    // 3. Lazy-loaded page chunks are intercepted
    const chunk1 = handleRequest('/assets/overview-DfK2x.js');
    expect(chunk1.handled).toBe(true);
    expect(chunk1.res._status).toBe(200);

    const chunk2 = handleRequest('/assets/feed-aB3cD.js');
    expect(chunk2.handled).toBe(true);
    expect(chunk2.res._status).toBe(200);

    // 4. Nested lazy chunks are intercepted
    const nested = handleRequest('/assets/lazy/chart-xY9z.js');
    expect(nested.handled).toBe(true);
    expect(nested.res._status).toBe(200);
  });

  it('should not intercept paths that partially match patterns', () => {
    const { handleRequest } = createServerPipeline();

    // '/client.js.map' should not match exact pattern '/client.js'
    expect(handleRequest('/client.js.map').handled).toBe(false);

    // '/assets-backup/file.js' should not match prefix pattern '/assets/'
    expect(handleRequest('/assets-backup/file.js').handled).toBe(false);

    // '/my/assets/file.js' should not match prefix pattern '/assets/'
    expect(handleRequest('/my/assets/file.js').handled).toBe(false);
  });
});
