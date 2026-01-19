import { describe, it, expect } from 'vitest';
import { createLocationFactory } from './location';
import { createTestEnv } from '../../view/src/test-utils';

describe('location() - basic properties', () => {
  function setup() {
    const env = createTestEnv();
    const currentPath = env.signal('/products?sort=price&filter=new#reviews');

    // Create a simple computed implementation
    const computed = <T>(fn: () => T) => {
      const s = env.signal(fn());
      env.effect(() => {
        s(fn());
      });
      // Return with peek method
      const result = (() => s()) as { (): T; peek: () => T };
      result.peek = () => s.peek();
      return result;
    };

    const location = createLocationFactory({
      signal: env.signal,
      computed,
      currentPath,
    });

    return { location, currentPath, env };
  }

  it('returns pathname from current path', () => {
    const { location } = setup();
    const loc = location();

    expect(loc.pathname()).toBe('/products');
  });

  it('returns search from current path', () => {
    const { location } = setup();
    const loc = location();

    expect(loc.search()).toBe('?sort=price&filter=new');
  });

  it('returns hash from current path', () => {
    const { location } = setup();
    const loc = location();

    expect(loc.hash()).toBe('#reviews');
  });

  it('parses query params to object', () => {
    const { location } = setup();
    const loc = location();

    expect(loc.query()).toEqual({ sort: 'price', filter: 'new' });
  });
});

describe('location() - empty/missing parts', () => {
  function setup(path: string) {
    const env = createTestEnv();
    const currentPath = env.signal(path);

    // Create a simple computed implementation
    const computed = <T>(fn: () => T) => {
      const s = env.signal(fn());
      env.effect(() => {
        s(fn());
      });
      const result = (() => s()) as { (): T; peek: () => T };
      result.peek = () => s.peek();
      return result;
    };

    const location = createLocationFactory({
      signal: env.signal,
      computed,
      currentPath,
    });

    return { location, currentPath };
  }

  it('handles path with no query or hash', () => {
    const { location } = setup('/about');
    const loc = location();

    expect(loc.pathname()).toBe('/about');
    expect(loc.search()).toBe('');
    expect(loc.hash()).toBe('');
    expect(loc.query()).toEqual({});
  });

  it('handles path with query but no hash', () => {
    const { location } = setup('/products?page=2');
    const loc = location();

    expect(loc.pathname()).toBe('/products');
    expect(loc.search()).toBe('?page=2');
    expect(loc.hash()).toBe('');
    expect(loc.query()).toEqual({ page: '2' });
  });

  it('handles path with hash but no query', () => {
    const { location } = setup('/docs#introduction');
    const loc = location();

    expect(loc.pathname()).toBe('/docs');
    expect(loc.search()).toBe('');
    expect(loc.hash()).toBe('#introduction');
    expect(loc.query()).toEqual({});
  });
});

describe('location() - reactive updates', () => {
  function setup() {
    const env = createTestEnv();
    const currentPath = env.signal('/');

    // Create a simple computed implementation
    const computed = <T>(fn: () => T) => {
      const s = env.signal(fn());
      env.effect(() => {
        s(fn());
      });
      const result = (() => s()) as { (): T; peek: () => T };
      result.peek = () => s.peek();
      return result;
    };

    const location = createLocationFactory({
      signal: env.signal,
      computed,
      currentPath,
    });

    return { location, currentPath };
  }

  it('pathname updates when path changes', () => {
    const { location, currentPath } = setup();
    const loc = location();

    expect(loc.pathname()).toBe('/');

    currentPath('/products');
    expect(loc.pathname()).toBe('/products');
  });

  it('search updates when path changes', () => {
    const { location, currentPath } = setup();
    const loc = location();

    expect(loc.search()).toBe('');

    currentPath('/products?sort=price');
    expect(loc.search()).toBe('?sort=price');
  });

  it('hash updates when path changes', () => {
    const { location, currentPath } = setup();
    const loc = location();

    expect(loc.hash()).toBe('');

    currentPath('/docs#api');
    expect(loc.hash()).toBe('#api');
  });

  it('query updates when path changes', () => {
    const { location, currentPath } = setup();
    const loc = location();

    expect(loc.query()).toEqual({});

    currentPath('/search?q=test&page=1');
    expect(loc.query()).toEqual({ q: 'test', page: '1' });
  });

  it('all properties update together on path change', () => {
    const { location, currentPath } = setup();
    const loc = location();

    currentPath('/products?sort=price#reviews');

    expect(loc.pathname()).toBe('/products');
    expect(loc.search()).toBe('?sort=price');
    expect(loc.hash()).toBe('#reviews');
    expect(loc.query()).toEqual({ sort: 'price' });
  });
});

describe('location() - query parsing edge cases', () => {
  function setup(path: string) {
    const env = createTestEnv();
    const currentPath = env.signal(path);

    // Create a simple computed implementation
    const computed = <T>(fn: () => T) => {
      const s = env.signal(fn());
      env.effect(() => {
        s(fn());
      });
      const result = (() => s()) as { (): T; peek: () => T };
      result.peek = () => s.peek();
      return result;
    };

    const location = createLocationFactory({
      signal: env.signal,
      computed,
      currentPath,
    });

    return { location };
  }

  it('handles multiple query params', () => {
    const { location } = setup(
      '/search?q=test&category=books&sort=recent&page=3'
    );
    const loc = location();

    expect(loc.query()).toEqual({
      q: 'test',
      category: 'books',
      sort: 'recent',
      page: '3',
    });
  });

  it('handles query params with equals signs in values', () => {
    const { location } = setup('/search?formula=a=b+c');
    const loc = location();

    expect(loc.query()).toEqual({ formula: 'a=b+c' });
  });

  it('handles empty query param values', () => {
    const { location } = setup('/search?q=&page=1');
    const loc = location();

    expect(loc.query()).toEqual({ q: '', page: '1' });
  });

  it('handles query params without values', () => {
    const { location } = setup('/search?debug');
    const loc = location();

    expect(loc.query()).toEqual({ debug: '' });
  });

  it('handles query with hash', () => {
    const { location } = setup('/search?q=test#results');
    const loc = location();

    expect(loc.query()).toEqual({ q: 'test' });
    expect(loc.hash()).toBe('#results');
  });
});
