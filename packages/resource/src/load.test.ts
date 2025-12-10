/**
 * Integration tests for load() async boundaries
 *
 * Tests the new fetcher/renderer API pattern:
 * load(fetcher, renderer) where:
 * - fetcher: () => Promise<T>
 * - renderer: (state: LoadState<T>) => RefSpec
 */

import { describe, it, expect } from 'vitest';
import { compose } from '@lattice/lattice';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@lattice/signals/extend';
import { createElModule } from '@lattice/view/el';
import { createMapModule } from '@lattice/view/map';
import { createMatchModule } from '@lattice/view/match';
import { MountModule } from '@lattice/view/deps/mount';
import type { RefSpec } from '@lattice/view/types';
import {
  createDOMServerAdapter,
  renderToStringAsync,
  renderToStringAsyncWithHydration,
} from '@lattice/ssr/server';

import { createLoadModule } from './load';
import type { LoadState } from './types';

/**
 * Create SSR service for tests
 */
function createSSRService() {
  const adapter = createDOMServerAdapter();
  const ElModule = createElModule(adapter);
  const MapModule = createMapModule(adapter);
  const MatchModule = createMatchModule(adapter);
  const LoadModuleInstance = createLoadModule(adapter);

  const svc = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    BatchModule,
    ElModule,
    MapModule,
    MatchModule,
    MountModule,
    LoadModuleInstance
  )();

  return {
    svc,
    adapter,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(svc),
  };
}

// ============================================================================
// Tests: load() with fetcher/renderer pattern
// ============================================================================

describe('load() with fetcher/renderer pattern', () => {
  it('should render async content with ready state', async () => {
    const { svc, mount } = createSSRService();
    const { el, load } = svc;

    const App = el('div')(
      load(
        async () => 'Loaded!',
        (state: LoadState<string>) => {
          switch (state.status) {
            case 'pending':
              return el('span')('Loading...');
            case 'error':
              return el('span')(`Error: ${state.error}`);
            case 'ready':
              return el('span')(state.data);
          }
        }
      )
    );

    const html = await renderToStringAsync(App, {
      svc,
      mount,
    });

    expect(html).toContain('<span>Loaded!</span>');
    expect(html).toContain('<div>');
    // Pending state should NOT appear in SSR output
    expect(html).not.toContain('Loading...');
  });

  it('should render multiple async children', async () => {
    const { svc, mount } = createSSRService();
    const { el, load } = svc;

    const App = el('div')(
      load(
        async () => 'First',
        (state: LoadState<string>) =>
          state.status === 'ready' ? el('span')(state.data) : el('span')('...')
      ),
      load(
        async () => 'Second',
        (state: LoadState<string>) =>
          state.status === 'ready' ? el('span')(state.data) : el('span')('...')
      )
    );

    const html = await renderToStringAsync(App, {
      svc,
      mount,
    });

    expect(html).toContain('First');
    expect(html).toContain('Second');
  });

  it('should render async content nested inside static elements', async () => {
    const { svc, mount } = createSSRService();
    const { el, load } = svc;

    const App = el('main')(
      el('h1')('Title'),
      el('section')(
        load(
          async () => ['Item 1', 'Item 2'],
          (state: LoadState<string[]>) => {
            if (state.status !== 'ready') return el('div')('Loading...');
            return el('ul')(...state.data.map((item) => el('li')(item)));
          }
        )
      ),
      el('footer')('Footer')
    );

    const html = await renderToStringAsync(App, {
      svc,
      mount,
    });

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<li>Item 1</li>');
    expect(html).toContain('<li>Item 2</li>');
    expect(html).toContain('<footer>Footer</footer>');
  });
});

// ============================================================================
// Tests: Async data loading - the primary use case
// ============================================================================

describe('Async data loading', () => {
  it('should fetch data and render it', async () => {
    const { svc, mount } = createSSRService();
    const { el, load } = svc;

    // Simulate API fetch
    const fetchProducts = async () => [
      { id: 1, name: 'Widget' },
      { id: 2, name: 'Gadget' },
    ];

    type Product = { id: number; name: string };

    const App = el('div')(
      load(
        fetchProducts,
        (state: LoadState<Product[]>) => {
          if (state.status !== 'ready') return el('div')('Loading...');
          return el('ul')(
            ...state.data.map((p) => el('li')(`${p.id}: ${p.name}`))
          );
        }
      )
    );

    const html = await renderToStringAsync(App, {
      svc,
      mount,
    });

    expect(html).toContain('1: Widget');
    expect(html).toContain('2: Gadget');
  });

  it('should resolve async loaders in parallel', async () => {
    const { svc, mount } = createSSRService();
    const { el, load } = svc;

    const startTime = Date.now();
    const resolveOrder: string[] = [];

    const App = el('div')(
      // First takes 50ms
      load(
        async () => {
          await new Promise((r) => setTimeout(r, 50));
          resolveOrder.push('slow');
          return 'Slow';
        },
        (state: LoadState<string>) =>
          el('span')(state.status === 'ready' ? state.data : '...')
      ),
      // Second takes 10ms
      load(
        async () => {
          await new Promise((r) => setTimeout(r, 10));
          resolveOrder.push('fast');
          return 'Fast';
        },
        (state: LoadState<string>) =>
          el('span')(state.status === 'ready' ? state.data : '...')
      )
    );

    await renderToStringAsync(App, {
      svc,
      mount,
    });

    const elapsed = Date.now() - startTime;

    // Should complete in ~50ms (parallel), not ~60ms (sequential)
    expect(elapsed).toBeLessThan(100);

    // Fast should resolve before slow due to parallel execution
    expect(resolveOrder).toEqual(['fast', 'slow']);
  });
});

// ============================================================================
// Tests: Hydration data collection
// ============================================================================

describe('Hydration data', () => {
  it('should serialize hydration data to script tag', async () => {
    const { svc, mount } = createSSRService();
    const { el, load } = svc;

    const products = [{ id: 1, name: 'Widget' }];

    const App = el('html')(
      el('body')(
        load(
          async () => products,
          (state: LoadState<typeof products>) => {
            if (state.status !== 'ready') return el('div')('Loading...');
            return el('ul')(...state.data.map((p) => el('li')(p.name)));
          }
        )
      )
    );

    const html = await renderToStringAsyncWithHydration(App, {
      svc,
      mount,
      scriptPlacement: 'body',
    });

    expect(html).toContain('window.__LATTICE_HYDRATION_DATA__=');
    expect(html).toContain('"id":1');
    expect(html).toContain('"name":"Widget"');
  });

  it('should collect hydration data from multiple loaders', async () => {
    const { svc, mount } = createSSRService();
    const { el, load } = svc;

    const App = el('html')(
      el('body')(
        load(
          async () => ({ users: ['Alice', 'Bob'] }),
          (state: LoadState<{ users: string[] }>) =>
            state.status === 'ready' ? el('div')('Users') : el('div')('...'),
          { id: 'users' }
        ),
        load(
          async () => ({ posts: ['Post 1', 'Post 2'] }),
          (state: LoadState<{ posts: string[] }>) =>
            state.status === 'ready' ? el('div')('Posts') : el('div')('...'),
          { id: 'posts' }
        )
      )
    );

    const result = await renderToStringAsyncWithHydration(App, {
      svc,
      mount,
      scriptPlacement: 'inline',
    });

    expect(result.data).toHaveProperty('users');
    expect(result.data).toHaveProperty('posts');
    expect(result.data['users']).toEqual({ users: ['Alice', 'Bob'] });
    expect(result.data['posts']).toEqual({ posts: ['Post 1', 'Post 2'] });
  });
});

// ============================================================================
// Tests: Error handling
// ============================================================================

describe('Error handling', () => {
  it('should render error state when fetcher throws', async () => {
    const { svc, mount } = createSSRService();
    const { el, load } = svc;

    const App = el('div')(
      load(
        async () => {
          throw new Error('Fetch failed');
        },
        (state: LoadState<never>) => {
          switch (state.status) {
            case 'pending':
              return el('span')('Loading...');
            case 'error':
              return el('span')(
                `Error: ${state.error instanceof Error ? state.error.message : 'Unknown'}`
              );
            case 'ready':
              return el('span')('Success');
          }
        }
      )
    );

    const html = await renderToStringAsync(App, {
      svc,
      mount,
    });

    expect(html).toContain('Error: Fetch failed');
    expect(html).not.toContain('Loading...');
    expect(html).not.toContain('Success');
  });

  it('should handle empty content', async () => {
    const { svc, mount } = createSSRService();
    const { el, load } = svc;

    const App = el('div')(
      load(
        async () => '',
        (state: LoadState<string>) =>
          el('span')(state.status === 'ready' ? state.data : 'loading')
      )
    );

    const html = await renderToStringAsync(App, {
      svc,
      mount,
    });

    expect(html).toContain('<div>');
    expect(html).toContain('<span>');
  });
});

// ============================================================================
// Tests: Component pattern - demonstrates the intended usage
// ============================================================================

describe('Component pattern', () => {
  it('should work with component factory pattern', async () => {
    const { svc, mount } = createSSRService();
    const { el, load } = svc;

    type StatsData = { users: number; views: number };

    // This is how load() is intended to be used in components
    const StatsPage = () =>
      load(
        async () => ({ users: 100, views: 1000 }),
        (state: LoadState<StatsData>) => {
          switch (state.status) {
            case 'pending':
              return el('div')('Loading stats...');
            case 'error':
              return el('div')('Failed to load stats');
            case 'ready':
              return el('div')(
                el('span')(`Users: ${state.data.users}`),
                el('span')(`Views: ${state.data.views}`)
              );
          }
        },
        { id: 'stats' }
      );

    const App = el('main')(el('h1')('Dashboard'), StatsPage());

    const html = await renderToStringAsync(App, {
      svc,
      mount,
    });

    expect(html).toContain('Dashboard');
    expect(html).toContain('Users: 100');
    expect(html).toContain('Views: 1000');
  });
});
