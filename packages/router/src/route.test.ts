import { describe, it, expect } from 'vitest';
import { matchPath, createRouteFactory } from './route';
import { createTestEnv, type MockRendererConfig, type MockElement, getTextContent } from '../../view/src/test-utils';
import { El } from '@lattice/view/el';
import { Match } from '@lattice/view/match';
import type { ElementRef, RefSpec } from '@lattice/view/types';
import { STATUS_ELEMENT } from '@lattice/view/types';

describe('matchPath - exact matching without parameters', () => {
  it('matches root path', () => {
    const result = matchPath('/', '/');
    expect(result).not.toBeNull();
  });

  it('matches simple path', () => {
    const result = matchPath('/about', '/about');
    expect(result).not.toBeNull();
  });

  it('does not match different paths', () => {
    const result = matchPath('/about', '/products');
    expect(result).toBeNull();
  });

  it('does not match root with non-root path', () => {
    const result = matchPath('/', '/about');
    expect(result).toBeNull();
  });
});

describe('matchPath - path parameters', () => {
  it('extracts single parameter', () => {
    const result = matchPath('/products/:id', '/products/123');
    expect(result).not.toBeNull();
    expect(result?.params).toEqual({ id: '123' });
  });

  it('extracts multiple parameters', () => {
    const result = matchPath('/users/:userId/posts/:postId', '/users/42/posts/99');
    expect(result).not.toBeNull();
    expect(result?.params).toEqual({ userId: '42', postId: '99' });
  });

  it('does not match when parameter value is missing', () => {
    const result = matchPath('/products/:id', '/products');
    expect(result).toBeNull();
  });

  it('does not match when base path is wrong', () => {
    const result = matchPath('/products/:id', '/about/123');
    expect(result).toBeNull();
  });
});

describe('route() - single route rendering', () => {
  function setup() {
    const env = createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    const match = Match<MockRendererConfig>().create({
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      disposeScope: env.disposeScope,
      onCleanup: env.onCleanup,
      getElementScope: env.getElementScope,
    });

    const currentPath = env.signal('/');

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

    const route = createRouteFactory<MockRendererConfig>().create({
      signal: env.signal,
      computed,
      el: el.method as never,
      match: match.method,
      currentPath,
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    return { ...env, el, route: route.method, currentPath };
  }

  // Helper to create and mount a route spec
  const mountRoute = (spec: RefSpec<MockElement>, renderer: { createElement: (tag: string) => MockElement }): MockElement => {
    const parent = renderer.createElement('div');
    const parentRef: ElementRef<MockElement> = {
      status: STATUS_ELEMENT,
      element: parent,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    };

    const nodeRef = spec.create();

    // Handle both element refs and fragment refs
    if ('attach' in nodeRef && typeof nodeRef.attach === 'function') {
      (nodeRef as { parent: unknown; next: unknown; attach: (parent: unknown, next: unknown) => void }).parent = parentRef;
      (nodeRef as { parent: unknown; next: unknown; attach: (parent: unknown, next: unknown) => void }).next = null;
      (nodeRef as { parent: unknown; next: unknown; attach: (parent: unknown, next: unknown) => void }).attach(parentRef, null);
    } else if ('element' in nodeRef) {
      const elementRef = nodeRef as ElementRef<MockElement>;
      elementRef.parent = parentRef;
      elementRef.next = null;
      parent.children.push(elementRef.element);
    }

    return parent;
  };

  it('renders component when path matches', () => {
    const { route, renderer } = setup();

    const HomeComponent = ({ el: elFn }: { el: (tag: string, props?: Record<string, unknown>) => (...children: unknown[]) => unknown }): RefSpec<MockElement> => {
      return elFn('div')('Home Page') as RefSpec<MockElement>;
    };

    const routeSpec = route('/', HomeComponent)();

    const parent = mountRoute(routeSpec, renderer);
    expect(getTextContent(parent)).toBe('Home Page');
  });

  it('renders component for non-root path when path matches', () => {
    const { route, currentPath, renderer } = setup();

    const AboutComponent = ({ el: elFn }: { el: (tag: string, props?: Record<string, unknown>) => (...children: unknown[]) => unknown }): RefSpec<MockElement> => {
      return elFn('div')('About Page') as RefSpec<MockElement>;
    };

    currentPath('/about');

    const routeSpec = route('/about', AboutComponent)();

    const parent = mountRoute(routeSpec, renderer);
    expect(getTextContent(parent)).toBe('About Page');
  });

  it('renders nothing when path does not match', () => {
    const { route, currentPath, renderer } = setup();

    const AboutComponent = ({ el: elFn }: { el: (tag: string, props?: Record<string, unknown>) => (...children: unknown[]) => unknown }): RefSpec<MockElement> => {
      return elFn('div')('About Page') as RefSpec<MockElement>;
    };

    currentPath('/products');

    const routeSpec = route('/about', AboutComponent)();

    const parent = mountRoute(routeSpec, renderer);
    expect(parent.children.length).toBe(0);
  });

  it('reactively updates when path changes', () => {
    const { route, currentPath, renderer } = setup();

    const HomeComponent = ({ el: elFn }: { el: (tag: string, props?: Record<string, unknown>) => (...children: unknown[]) => unknown }): RefSpec<MockElement> => {
      return elFn('div')('Home Page') as RefSpec<MockElement>;
    };

    const routeSpec = route('/', HomeComponent)();

    const parent = mountRoute(routeSpec, renderer);
    expect(getTextContent(parent)).toBe('Home Page');

    currentPath('/about');
    expect(parent.children.length).toBe(0);

    currentPath('/');
    expect(getTextContent(parent)).toBe('Home Page');
  });

  it('accepts lifecycle callbacks', () => {
    const { route, renderer } = setup();

    const HomeComponent = ({ el: elFn }: { el: (tag: string, props?: Record<string, unknown>) => (...children: unknown[]) => unknown }): RefSpec<MockElement> => {
      return elFn('div')('Home Page') as RefSpec<MockElement>;
    };

    // RefSpec can be called with lifecycle callbacks
    const routeSpec = route('/', HomeComponent)()();

    const parent = mountRoute(routeSpec, renderer);
    expect(getTextContent(parent)).toBe('Home Page');
  });
});

describe('multiple routes - reactive switching', () => {
  function setup() {
    const env = createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    const match = Match<MockRendererConfig>().create({
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      disposeScope: env.disposeScope,
      onCleanup: env.onCleanup,
      getElementScope: env.getElementScope,
    });

    const currentPath = env.signal('/');

    const computed = <T>(fn: () => T) => {
      const s = env.signal(fn());
      env.effect(() => {
        s(fn());
      });
      const result = (() => s()) as { (): T; peek: () => T };
      result.peek = () => s.peek();
      return result;
    };

    const route = createRouteFactory<MockRendererConfig>().create({
      signal: env.signal,
      computed,
      el: el.method as never,
      match: match.method,
      currentPath,
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    return { ...env, el, route: route.method, currentPath };
  }

  const mountRoute = (spec: RefSpec<MockElement>, renderer: { createElement: (tag: string) => MockElement }): MockElement => {
    const parent = renderer.createElement('div');
    const parentRef: ElementRef<MockElement> = {
      status: STATUS_ELEMENT,
      element: parent,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    };

    const nodeRef = spec.create();

    if ('attach' in nodeRef && typeof nodeRef.attach === 'function') {
      (nodeRef as { parent: unknown; next: unknown; attach: (parent: unknown, next: unknown) => void }).parent = parentRef;
      (nodeRef as { parent: unknown; next: unknown; attach: (parent: unknown, next: unknown) => void }).next = null;
      (nodeRef as { parent: unknown; next: unknown; attach: (parent: unknown, next: unknown) => void }).attach(parentRef, null);
    } else if ('element' in nodeRef) {
      const elementRef = nodeRef as ElementRef<MockElement>;
      elementRef.parent = parentRef;
      elementRef.next = null;
      parent.children.push(elementRef.element);
    }

    return parent;
  };

  it('only renders the matched route', () => {
    const { route, el, renderer } = setup();

    const Home = ({ el: elFn }: { el: (tag: string) => (...children: unknown[]) => unknown }) =>
      elFn('div')('Home') as RefSpec<MockElement>;

    const About = ({ el: elFn }: { el: (tag: string) => (...children: unknown[]) => unknown }) =>
      elFn('div')('About') as RefSpec<MockElement>;

    const Products = ({ el: elFn }: { el: (tag: string) => (...children: unknown[]) => unknown }) =>
      elFn('div')('Products') as RefSpec<MockElement>;

    const routesSpec = el.method('div')(
      route('/', Home)(),
      route('/about', About)(),
      route('/products', Products)()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('Home');
  });

  it('switches from Home to About when path changes', () => {
    const { route, el, currentPath, renderer } = setup();

    const Home = ({ el: elFn }: { el: (tag: string) => (...children: unknown[]) => unknown }) =>
      elFn('div')('Home') as RefSpec<MockElement>;

    const About = ({ el: elFn }: { el: (tag: string) => (...children: unknown[]) => unknown }) =>
      elFn('div')('About') as RefSpec<MockElement>;

    const routesSpec = el.method('div')(
      route('/', Home)(),
      route('/about', About)()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('Home');

    currentPath('/about');
    expect(getTextContent(parent)).toBe('About');
  });

  it('renders nothing when path matches no routes', () => {
    const { route, el, currentPath, renderer } = setup();

    const Home = ({ el: elFn }: { el: (tag: string) => (...children: unknown[]) => unknown }) =>
      elFn('div')('Home') as RefSpec<MockElement>;

    const About = ({ el: elFn }: { el: (tag: string) => (...children: unknown[]) => unknown }) =>
      elFn('div')('About') as RefSpec<MockElement>;

    const routesSpec = el.method('div')(
      route('/', Home)(),
      route('/about', About)()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('Home');

    currentPath('/unknown');
    expect(getTextContent(parent)).toBe('');
  });

  it('first matching route wins when multiple routes match', () => {
    const { route, el, currentPath, renderer } = setup();

    const First = ({ el: elFn }: { el: (tag: string) => (...children: unknown[]) => unknown }) =>
      elFn('div')('First') as RefSpec<MockElement>;

    const Second = ({ el: elFn }: { el: (tag: string) => (...children: unknown[]) => unknown }) =>
      elFn('div')('Second') as RefSpec<MockElement>;

    currentPath('/test');

    const routesSpec = el.method('div')(
      route('/test', First)(),
      route('/test', Second)()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('First');
  });

  it('switches between all routes as path changes', () => {
    const { route, el, currentPath, renderer } = setup();

    const Home = ({ el: elFn }: { el: (tag: string) => (...children: unknown[]) => unknown }) =>
      elFn('div')('Home') as RefSpec<MockElement>;

    const About = ({ el: elFn }: { el: (tag: string) => (...children: unknown[]) => unknown }) =>
      elFn('div')('About') as RefSpec<MockElement>;

    const Products = ({ el: elFn }: { el: (tag: string) => (...children: unknown[]) => unknown }) =>
      elFn('div')('Products') as RefSpec<MockElement>;

    const routesSpec = el.method('div')(
      route('/', Home)(),
      route('/about', About)(),
      route('/products', Products)()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('Home');

    currentPath('/products');
    expect(getTextContent(parent)).toBe('Products');

    currentPath('/about');
    expect(getTextContent(parent)).toBe('About');

    currentPath('/');
    expect(getTextContent(parent)).toBe('Home');
  });
});
