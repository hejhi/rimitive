/**
 * Tests for renderToStringAsync — hydration round-trip and loader integration
 */

import { describe, it, expect, vi } from 'vitest';
import { createLoader } from '@rimitive/view/load';
import type { LoadState } from '@rimitive/view/load';
import {
  createMockRefSpec,
  createServerTestEnv,
  mockMount,
} from './test-fixtures';

describe('renderToStringAsync - hydration round-trip', () => {
  it('should serialize server data that client can consume without re-fetching', async () => {
    // --- Server side ---
    const serverEnv = createServerTestEnv();
    const serverLoader = createLoader({ signal: serverEnv.signal });

    const ServerApp = serverLoader.load(
      'user-1',
      () => Promise.resolve({ name: 'Alice' }),
      (state: LoadState<{ name: string }>) => {
        if (state.status() === 'ready')
          return createMockRefSpec(`<div>${state.data()?.name}</div>`);
        return createMockRefSpec('<div>Loading...</div>');
      }
    );

    const serverNode = mockMount(ServerApp);
    const serverMeta = (serverNode as unknown as { [key: symbol]: { resolve: () => Promise<unknown> } })[
      Symbol.for('rimitive.async-fragment')
    ]!;
    await serverMeta.resolve();

    // Server collects data
    const serverData = serverLoader.getData();
    expect(serverData).toEqual({ 'user-1': { name: 'Alice' } });

    // Simulate serialization to JSON (as would happen in <script> tag)
    const serializedJson = JSON.stringify(serverData);

    // --- Client side ---
    const clientEnv = createServerTestEnv();
    const clientFetcher = vi.fn(() => Promise.resolve({ name: 'Stale' }));
    const clientLoader = createLoader({
      signal: clientEnv.signal,
      initialData: JSON.parse(serializedJson),
    });

    let clientState: LoadState<{ name: string }> | null = null;
    clientLoader.load(
      'user-1',
      clientFetcher,
      (state: LoadState<{ name: string }>) => {
        clientState = state;
        return createMockRefSpec('<div>Client</div>');
      }
    );

    // Client should not fetch — it has initial data from the server
    expect(clientFetcher).not.toHaveBeenCalled();
    expect(clientState!.status()).toBe('ready');
    expect(clientState!.data()).toEqual({ name: 'Alice' });
  });

  it('should handle multiple boundaries in hydration round-trip', async () => {
    // Server
    const serverEnv = createServerTestEnv();
    const serverLoader = createLoader({ signal: serverEnv.signal });

    const specs = [
      serverLoader.load('nav', () => Promise.resolve({ items: ['Home', 'About'] }), () => createMockRefSpec('<nav>Nav</nav>')),
      serverLoader.load('content', () => Promise.resolve({ title: 'Hello' }), () => createMockRefSpec('<main>Main</main>')),
      serverLoader.load('footer', () => Promise.resolve({ year: 2026 }), () => createMockRefSpec('<footer>Footer</footer>')),
    ];

    for (const spec of specs) {
      const node = mockMount(spec);
      const meta = (node as unknown as { [key: symbol]: { resolve: () => Promise<unknown> } })[
        Symbol.for('rimitive.async-fragment')
      ]!;
      await meta.resolve();
    }

    const serverData = serverLoader.getData();
    const serialized = JSON.stringify(serverData);

    // Client
    const clientEnv = createServerTestEnv();
    const clientLoader = createLoader({
      signal: clientEnv.signal,
      initialData: JSON.parse(serialized),
    });

    const clientFetchers = {
      nav: vi.fn(() => Promise.resolve(null)),
      content: vi.fn(() => Promise.resolve(null)),
      footer: vi.fn(() => Promise.resolve(null)),
    };

    const states: Record<string, LoadState<unknown>> = {};

    clientLoader.load('nav', clientFetchers.nav, (s) => { states['nav'] = s; return createMockRefSpec(''); });
    clientLoader.load('content', clientFetchers.content, (s) => { states['content'] = s; return createMockRefSpec(''); });
    clientLoader.load('footer', clientFetchers.footer, (s) => { states['footer'] = s; return createMockRefSpec(''); });

    // None of the fetchers should have been called
    expect(clientFetchers.nav).not.toHaveBeenCalled();
    expect(clientFetchers.content).not.toHaveBeenCalled();
    expect(clientFetchers.footer).not.toHaveBeenCalled();

    // All should be in ready state with server data
    expect(states['nav']!.status()).toBe('ready');
    expect(states['nav']!.data()).toEqual({ items: ['Home', 'About'] });
    expect(states['content']!.status()).toBe('ready');
    expect(states['content']!.data()).toEqual({ title: 'Hello' });
    expect(states['footer']!.status()).toBe('ready');
    expect(states['footer']!.data()).toEqual({ year: 2026 });
  });
});

describe('renderToStringAsync - loader integration', () => {
  it('should resolve all loader boundaries and produce final HTML', async () => {
    const { signal } = createServerTestEnv();
    const loader = createLoader({ signal });

    const App = loader.load(
      'main-data',
      () => Promise.resolve({ title: 'Hello World' }),
      (state: LoadState<{ title: string }>) => {
        if (state.status() === 'ready')
          return createMockRefSpec(`<h1>${state.data()?.title}</h1>`);
        return createMockRefSpec('<h1>Loading...</h1>');
      }
    );

    // Mount and resolve via renderToStringAsync helper pattern
    const appNode = mockMount(App);

    // The node has async metadata — resolve it
    const asyncSym = Symbol.for('rimitive.async-fragment');
    const meta = (appNode as Record<symbol, { resolve: () => Promise<unknown> }>)[asyncSym]!;
    await meta.resolve();

    // Verify getData() has the resolved data
    expect(loader.getData()).toEqual({ 'main-data': { title: 'Hello World' } });
  });

  it('should work with eager load during renderToStringAsync', async () => {
    const { signal } = createServerTestEnv();
    const fetchCount = { count: 0 };

    const loader = createLoader({ signal });

    const App = loader.load(
      'eager-async-1',
      () => {
        fetchCount.count++;
        return Promise.resolve('eager-resolved');
      },
      (state: LoadState<string>) => {
        if (state.status() === 'ready')
          return createMockRefSpec(`<div>${state.data()}</div>`);
        return createMockRefSpec('<div>Loading...</div>');
      },
      { eager: true }
    );

    const appNode = mockMount(App);

    // The eager fetch is already in flight — resolve() should piggyback
    const asyncSym = Symbol.for('rimitive.async-fragment');
    const meta = (appNode as Record<symbol, { resolve: () => Promise<unknown> }>)[asyncSym]!;
    await meta.resolve();

    // Fetcher should have been called exactly once
    expect(fetchCount.count).toBe(1);

    // Data should be collected
    expect(loader.getData()).toEqual({ 'eager-async-1': 'eager-resolved' });
  });
});
