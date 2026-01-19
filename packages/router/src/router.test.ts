import { describe, it, expect } from 'vitest';
import { createRouter, type RouteConfig } from './router';

// Mock signal primitives
function createMockDeps() {
  const signals = new Map<symbol, unknown>();
  const computeds = new Map<symbol, () => unknown>();
  const subscribers = new Set<() => void>();

  const signal = <T>(initial: T) => {
    const id = Symbol();
    signals.set(id, initial);

    const accessor = ((value?: T) => {
      if (value !== undefined) {
        signals.set(id, value);
        // Notify subscribers
        subscribers.forEach((fn) => fn());
      }
      return signals.get(id) as T;
    }) as { (): T; (value: T): void };

    return accessor;
  };

  const computed = <T>(fn: () => T) => {
    const id = Symbol();
    computeds.set(id, fn);

    return (() => fn()) as { (): T };
  };

  return { signal, computed, _subscribers: subscribers };
}

describe('createRouter', () => {
  const routes: RouteConfig[] = [
    { id: 'home', path: '' },
    { id: 'about', path: 'about' },
    {
      id: 'products',
      path: 'products',
      children: [{ id: 'product-detail', path: ':id' }],
    },
  ];

  it('should match root path', () => {
    const deps = createMockDeps();
    const router = createRouter(deps, routes, { initialPath: '/' });

    const matches = router.matches();
    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe('home');
  });

  it('should match simple path', () => {
    const deps = createMockDeps();
    const router = createRouter(deps, routes, { initialPath: '/about' });

    const matches = router.matches();
    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe('about');
  });

  it('should match nested routes', () => {
    const deps = createMockDeps();
    const router = createRouter(deps, routes, { initialPath: '/products/123' });

    const matches = router.matches();
    expect(matches).toHaveLength(2);
    expect(matches[0]?.id).toBe('products');
    expect(matches[1]?.id).toBe('product-detail');
    expect(matches[1]?.params).toEqual({ id: '123' });
  });

  it('should return empty matches for unknown path', () => {
    const deps = createMockDeps();
    const router = createRouter(deps, routes, { initialPath: '/unknown' });

    const matches = router.matches();
    expect(matches).toHaveLength(0);
  });

  it('should provide currentPath signal', () => {
    const deps = createMockDeps();
    const router = createRouter(deps, routes, { initialPath: '/about' });

    expect(router.currentPath()).toBe('/about');
  });

  it('should update matches on navigate', () => {
    const deps = createMockDeps();
    const router = createRouter(deps, routes, { initialPath: '/' });

    expect(router.matches()[0]?.id).toBe('home');

    router.navigate('/about');

    expect(router.currentPath()).toBe('/about');
    expect(router.matches()[0]?.id).toBe('about');
  });

  it('should extract params from path', () => {
    const deps = createMockDeps();
    const router = createRouter(deps, routes, {
      initialPath: '/products/abc-123',
    });

    const matches = router.matches();
    expect(matches[1]?.params).toEqual({ id: 'abc-123' });
  });

  it('should strip query string for matching', () => {
    const deps = createMockDeps();
    const router = createRouter(deps, routes, {
      initialPath: '/about?foo=bar',
    });

    const matches = router.matches();
    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe('about');
  });

  it('should strip hash for matching', () => {
    const deps = createMockDeps();
    const router = createRouter(deps, routes, {
      initialPath: '/about#section',
    });

    const matches = router.matches();
    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe('about');
  });
});
