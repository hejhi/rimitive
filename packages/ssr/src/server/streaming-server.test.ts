/**
 * Tests for the streaming server abstraction
 *
 * Uses the real createHtmlShell and renderToStream functions with
 * controlled service/app mocks. The mock NodeRef has STATUS_ELEMENT
 * so renderToStream produces a simple HTML string without async fragments.
 */

import { describe, it, expect, vi } from 'vitest';
import { createStreamingServer } from './streaming-server';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RefSpec, NodeRef, FragmentRef } from '@rimitive/view/types';
import { STATUS_ELEMENT } from '@rimitive/view/types';
import type { Serialize } from './parse5-adapter';

function createMockReq(url: string): IncomingMessage {
  return {
    url,
    headers: { host: 'localhost:3000' },
  } as unknown as IncomingMessage;
}

function createMockRes(): ServerResponse & {
  _written: string[];
  _status: number;
  _headers: Record<string, string>;
  _ended: boolean;
} {
  const res = {
    _written: [] as string[],
    _status: 0,
    _headers: {} as Record<string, string>,
    _ended: false,
    writeHead(status: number, headers?: Record<string, string>) {
      res._status = status;
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

/**
 * Create a minimal mock NodeRef with STATUS_ELEMENT.
 * renderToStream uses serialize(nodeRef.element) for element nodes.
 */
function createMockNodeRef(html: string): NodeRef<unknown> {
  return {
    status: STATUS_ELEMENT,
    element: html,
    next: null,
    prev: null,
  } as unknown as NodeRef<unknown>;
}

/**
 * Create a serialize function that returns the element as a string.
 */
function createMockSerialize(): Serialize {
  return ((element: unknown) => String(element)) as Serialize;
}

describe('createStreamingServer', () => {
  function createConfig(overrides?: { rootId?: string | false }) {
    let capturedOnResolve: ((id: string, data: unknown) => void) | undefined;

    const config = {
      shell: {
        title: 'Test App',
        streamKey: '__TEST_STREAM__',
        rootId: overrides?.rootId ?? (false as const),
      },
      clientSrc: '/client.js',
      createService: vi.fn(
        ({
          pathname,
          onResolve,
        }: {
          pathname: string;
          onResolve: (id: string, data: unknown) => void;
        }) => {
          capturedOnResolve = onResolve;
          const nodeRef = createMockNodeRef(`<div class="app">${pathname}</div>`);
          return {
            service: { pathname, nodeRef },
            serialize: createMockSerialize(),
            insertFragmentMarkers: vi.fn() as (fragment: FragmentRef<unknown>) => void,
          };
        },
      ),
      createApp: vi.fn(
        (svc: { pathname: string; nodeRef: NodeRef<unknown> }) =>
          ({ _nodeRef: svc.nodeRef }) as unknown as RefSpec<unknown>,
      ),
      mount: vi.fn(
        (svc: { pathname: string; nodeRef: NodeRef<unknown> }) =>
          (_spec: RefSpec<unknown>) =>
            svc.nodeRef,
      ),
    };

    return {
      config,
      getOnResolve: () => capturedOnResolve,
    };
  }

  it('should return a handler function', () => {
    const { config } = createConfig();
    const handler = createStreamingServer(config);
    expect(typeof handler).toBe('function');
  });

  it('should set correct HTTP headers', async () => {
    const { config } = createConfig();
    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('text/html');
  });

  it('should write HTML shell with title and bootstrap', async () => {
    const { config } = createConfig();
    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    await handler(req, res);

    const fullOutput = res._written.join('');
    expect(fullOutput).toContain('<!DOCTYPE html>');
    expect(fullOutput).toContain('<title>Test App</title>');
    expect(fullOutput).toContain('__TEST_STREAM__');
  });

  it('should write initial HTML from render', async () => {
    const { config } = createConfig();
    const handler = createStreamingServer(config);
    const req = createMockReq('/overview');
    const res = createMockRes();

    await handler(req, res);

    const fullOutput = res._written.join('');
    expect(fullOutput).toContain('<div class="app">/overview</div>');
  });

  it('should write client script tag', async () => {
    const { config } = createConfig();
    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    await handler(req, res);

    const fullOutput = res._written.join('');
    expect(fullOutput).toContain('<script type="module" src="/client.js"></script>');
  });

  it('should close the document and end response', async () => {
    const { config } = createConfig();
    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    await handler(req, res);

    const fullOutput = res._written.join('');
    expect(fullOutput).toContain('</body></html>');
    expect(res._ended).toBe(true);
  });

  it('should pass pathname to createService', async () => {
    const { config } = createConfig();
    const handler = createStreamingServer(config);
    const req = createMockReq('/sites/site-1');
    const res = createMockRes();

    await handler(req, res);

    expect(config.createService).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/sites/site-1' }),
    );
  });

  it('should wire onResolve that writes chunk scripts', async () => {
    const { config, getOnResolve } = createConfig();
    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    // Handler resolves immediately for zero-boundary case (no async fragments)
    await handler(req, res);

    // onResolve should have been wired during createService
    const onResolve = getOnResolve();
    expect(onResolve).toBeDefined();

    // Simulate a chunk (would occur during await done in a real scenario)
    onResolve!('stats', { views: 100 });

    const fullOutput = res._written.join('');
    expect(fullOutput).toContain('__TEST_STREAM__');
  });

  it('should skip root wrapper when rootId is false', async () => {
    const { config } = createConfig({ rootId: false });
    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    await handler(req, res);

    const fullOutput = res._written.join('');
    expect(fullOutput).not.toContain('<div id="app">');
  });

  it('should include root wrapper when rootId is provided', async () => {
    const { config } = createConfig({ rootId: 'root' });
    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    await handler(req, res);

    const fullOutput = res._written.join('');
    expect(fullOutput).toContain('<div id="root">');
  });

  it('should handle default path for missing req.url', async () => {
    const { config } = createConfig();
    const handler = createStreamingServer(config);
    const req = { url: undefined, headers: { host: 'localhost' } } as unknown as IncomingMessage;
    const res = createMockRes();

    await handler(req, res);

    expect(config.createService).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/' }),
    );
  });

  it('should write output in correct order', async () => {
    const { config } = createConfig();
    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    await handler(req, res);

    const fullOutput = res._written.join('');

    const doctypeIdx = fullOutput.indexOf('<!DOCTYPE html>');
    const headIdx = fullOutput.indexOf('<head>');
    const bodyIdx = fullOutput.indexOf('<body>');
    const appIdx = fullOutput.indexOf('<div class="app">');
    const clientIdx = fullOutput.indexOf('/client.js');
    const closeIdx = fullOutput.indexOf('</body></html>');

    expect(doctypeIdx).toBeLessThan(headIdx);
    expect(headIdx).toBeLessThan(bodyIdx);
    expect(bodyIdx).toBeLessThan(appIdx);
    expect(appIdx).toBeLessThan(clientIdx);
    expect(clientIdx).toBeLessThan(closeIdx);
  });
});
