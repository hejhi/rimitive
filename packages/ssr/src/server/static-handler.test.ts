/**
 * Tests for static file handler
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
