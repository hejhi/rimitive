/**
 * Tests for the streaming server abstraction
 *
 * Uses the real createHtmlShell and renderToStream functions with
 * controlled service/app mocks. The mock NodeRef has STATUS_ELEMENT
 * so renderToStream produces a simple HTML string without async fragments.
 *
 * Also includes integration tests that verify the full streaming flow
 * with real async boundaries (loader + onResolve + chunk scripts).
 */

import { describe, it, expect, vi } from 'vitest';
import { createStreamingServer } from './streaming-server';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RefSpec, NodeRef, FragmentRef } from '@rimitive/view/types';
import { STATUS_ELEMENT } from '@rimitive/view/types';
import type { Serialize } from './parse5-adapter';
import { createLoader } from '@rimitive/view/load';
import type { LoadState } from '@rimitive/view/load';
import { createServerTestEnv, createMockRefSpec, serialize, mockInsertFragmentMarkers } from './test-fixtures';

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

/**
 * Integration tests for streaming server with real async boundaries.
 *
 * These tests verify the full end-to-end streaming flow:
 * - HTML shell sent immediately with bootstrap script
 * - Initial HTML with pending states for async boundaries
 * - Data chunks stream via onResolve through script tags
 * - Client script sent before streaming completes
 * - Document closed after all boundaries resolve
 */
describe('createStreamingServer — streaming integration', () => {
  type BoundaryDef = {
    id: string;
    fetcher: () => Promise<unknown>;
    pendingHtml: string;
  };

  type TestService = {
    loader: ReturnType<typeof createLoader>;
    boundaries: BoundaryDef[];
  };

  /**
   * Create a streaming server config that uses real loader + signal
   * to produce async boundaries with controlled resolution.
   */
  function createStreamingConfig(options: {
    boundaries: BoundaryDef[];
    streamKey?: string;
  }) {
    const { signal } = createServerTestEnv();
    const streamKey = options.streamKey ?? '__INTEGRATION_STREAM__';

    const config = {
      shell: {
        title: 'Integration Test',
        streamKey,
        rootId: false as const,
      },
      clientSrc: '/client.js',
      createService: ({ onResolve }: { pathname: string; onResolve: (id: string, data: unknown) => void }) => {
        const loader = createLoader({ signal, onResolve });

        return {
          service: { loader, boundaries: options.boundaries } as TestService,
          serialize,
          insertFragmentMarkers: mockInsertFragmentMarkers,
        };
      },
      createApp: (svc: TestService) => {
        // Build a container RefSpec whose create() produces a tree with
        // async fragments from loader.load() as children
        const containerSpec: RefSpec<unknown> = {
          status: 4 as RefSpec<unknown>['status'],
          create: () => {
            const childSpecs = svc.boundaries.map((b) =>
              svc.loader.load(
                b.id,
                b.fetcher,
                (state: LoadState<unknown>) => {
                  if (state.status() === 'pending') return createMockRefSpec(b.pendingHtml);
                  return createMockRefSpec(`<div data-resolved="${b.id}">${JSON.stringify(state.data())}</div>`);
                },
              ),
            );

            // Create (mount) each child spec to get NodeRefs with async metadata
            const childNodes = childSpecs.map((spec) => spec.create());

            // Link nodes as siblings
            for (let i = 0; i < childNodes.length - 1; i++) {
              childNodes[i].next = childNodes[i + 1];
            }

            // Build root element that contains children
            const rootNode = {
              status: 1 as const,
              element: { outerHTML: '<div class="app-root">content</div>' },
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

    return { config, streamKey };
  }

  it('should stream all three parallel boundaries with correct data', async () => {
    const { config, streamKey } = createStreamingConfig({
      boundaries: [
        {
          id: 'metrics',
          fetcher: () => Promise.resolve({ visitors: 24521 }),
          pendingHtml: '<div class="skeleton">Loading metrics...</div>',
        },
        {
          id: 'top-pages',
          fetcher: () => Promise.resolve([{ path: '/', views: 45230 }]),
          pendingHtml: '<div class="skeleton">Loading pages...</div>',
        },
        {
          id: 'referrers',
          fetcher: () => Promise.resolve([{ source: 'Google', visitors: 12340 }]),
          pendingHtml: '<div class="skeleton">Loading referrers...</div>',
        },
      ],
    });

    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    await handler(req, res);

    const fullOutput = res._written.join('');

    // Verify HTML shell structure
    expect(fullOutput).toContain('<!DOCTYPE html>');
    expect(fullOutput).toContain('<title>Integration Test</title>');
    expect(fullOutput).toContain('</body></html>');
    expect(res._ended).toBe(true);

    // Verify bootstrap script for streaming
    expect(fullOutput).toContain(streamKey);

    // Verify client script is present
    expect(fullOutput).toContain('<script type="module" src="/client.js"></script>');

    // Verify all three data chunks were streamed
    expect(fullOutput).toContain(`${streamKey}.push("metrics"`);
    expect(fullOutput).toContain(`${streamKey}.push("top-pages"`);
    expect(fullOutput).toContain(`${streamKey}.push("referrers"`);

    // Verify chunk data is correct
    expect(fullOutput).toContain('"visitors":24521');
    expect(fullOutput).toContain('"views":45230');
    expect(fullOutput).toContain('"source":"Google"');
  });

  it('should send client script before streaming chunks in output order', async () => {
    const { config } = createStreamingConfig({
      boundaries: [
        {
          id: 'async-data',
          fetcher: () => Promise.resolve({ value: 42 }),
          pendingHtml: '<div>Loading...</div>',
        },
      ],
    });

    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    await handler(req, res);

    const fullOutput = res._written.join('');

    // Client script must come before streaming data chunks
    const clientScriptIdx = fullOutput.indexOf('/client.js');
    const chunkIdx = fullOutput.indexOf('.push("async-data"');
    const closeIdx = fullOutput.indexOf('</body></html>');

    expect(clientScriptIdx).toBeGreaterThan(-1);
    expect(chunkIdx).toBeGreaterThan(-1);
    expect(closeIdx).toBeGreaterThan(-1);

    // Client script before chunks, chunks before document close
    expect(clientScriptIdx).toBeLessThan(chunkIdx);
    expect(chunkIdx).toBeLessThan(closeIdx);
  });

  it('should handle boundaries with delayed resolution', async () => {
    let resolveDelayed: ((value: { status: string }) => void) | undefined;
    const delayedPromise = new Promise<{ status: string }>((r) => {
      resolveDelayed = r;
    });

    const { config, streamKey } = createStreamingConfig({
      boundaries: [
        {
          id: 'delayed-boundary',
          fetcher: () => delayedPromise,
          pendingHtml: '<div>Waiting...</div>',
        },
      ],
    });

    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    // Start the handler (it will await done)
    const handlerPromise = handler(req, res);

    // Handler should not be finished yet
    let finished = false;
    handlerPromise.then(() => { finished = true; });
    await Promise.resolve();
    await Promise.resolve();
    expect(finished).toBe(false);

    // Shell + initial HTML + client script should already be written
    const partialOutput = res._written.join('');
    expect(partialOutput).toContain('<!DOCTYPE html>');
    expect(partialOutput).toContain('/client.js');

    // Resolve the delayed boundary
    resolveDelayed!({ status: 'complete' });
    await handlerPromise;

    // Now the chunk and document close should be written
    const fullOutput = res._written.join('');
    expect(fullOutput).toContain(`${streamKey}.push("delayed-boundary"`);
    expect(fullOutput).toContain('"status":"complete"');
    expect(fullOutput).toContain('</body></html>');
    expect(res._ended).toBe(true);
  });

  it('should handle zero async boundaries gracefully', async () => {
    const { config } = createStreamingConfig({ boundaries: [] });

    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    await handler(req, res);

    const fullOutput = res._written.join('');

    // Should still have full HTML structure
    expect(fullOutput).toContain('<!DOCTYPE html>');
    expect(fullOutput).toContain('/client.js');
    expect(fullOutput).toContain('</body></html>');
    expect(res._ended).toBe(true);

    // No streaming data chunks (bootstrap's .push in the receiver definition is ok)
    const chunkPushes = fullOutput.match(/__INTEGRATION_STREAM__\.push\("/g);
    expect(chunkPushes).toBeNull();
  });

  it('should handle boundary fetch errors without breaking the stream', async () => {
    const { config, streamKey } = createStreamingConfig({
      boundaries: [
        {
          id: 'good-data',
          fetcher: () => Promise.resolve({ ok: true }),
          pendingHtml: '<div>Loading...</div>',
        },
        {
          id: 'bad-data',
          fetcher: () => Promise.reject(new Error('Network error')),
          pendingHtml: '<div>Loading...</div>',
        },
      ],
    });

    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    // Should not throw
    await handler(req, res);

    const fullOutput = res._written.join('');

    // Document should still be properly closed
    expect(fullOutput).toContain('</body></html>');
    expect(res._ended).toBe(true);

    // Good boundary should still have streamed its data
    expect(fullOutput).toContain(`${streamKey}.push("good-data"`);
  });

  it('should stream chunks wrapped in script tags', async () => {
    const { config } = createStreamingConfig({
      boundaries: [
        {
          id: 'script-test',
          fetcher: () => Promise.resolve({ count: 5 }),
          pendingHtml: '<div>Loading...</div>',
        },
      ],
    });

    const handler = createStreamingServer(config);
    const req = createMockReq('/');
    const res = createMockRes();

    await handler(req, res);

    const fullOutput = res._written.join('');

    // Chunks should be wrapped in <script> tags
    const chunkMatch = fullOutput.match(/<script>[^<]*\.push\("script-test"[^<]*<\/script>/);
    expect(chunkMatch).not.toBeNull();
  });
});
