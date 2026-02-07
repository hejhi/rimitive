/**
 * Tests for data prefetch handler
 */

import { describe, it, expect, vi } from 'vitest';
import { createDataPrefetchHandler } from './data-prefetch-handler';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RefSpec, NodeRef } from '@rimitive/view/types';

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
