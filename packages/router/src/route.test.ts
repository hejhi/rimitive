import { describe, it, expect } from 'vitest';
import { matchPath, createRouteFactory } from './route';
import {
  createTestEnv,
  type MockRendererConfig,
  type MockElement,
  getTextContent,
} from '../../view/src/test-utils';
import { El } from '@lattice/view/el';
import { Match } from '@lattice/view/match';
import { Show } from '@lattice/view/show';
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
    const result = matchPath(
      '/users/:userId/posts/:postId',
      '/users/42/posts/99'
    );
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

    const show = Show<MockRendererConfig>().create({
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
      el: el.impl as never,
      match: match.impl,
      show: show.impl,
      currentPath,
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    return { ...env, el, route: route.impl, currentPath };
  }

  // Helper to create and mount a route spec
  const mountRoute = (
    spec: RefSpec<MockElement>,
    renderer: { createElement: (tag: string) => MockElement }
  ): MockElement => {
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
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).parent = parentRef;
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).next = null;
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).attach(parentRef, null);
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

    const HomeComponent = ({
      el: elFn,
    }: {
      el: (
        tag: string,
        props?: Record<string, unknown>
      ) => (...children: unknown[]) => unknown;
    }): RefSpec<MockElement> => {
      return elFn('div')('Home Page') as RefSpec<MockElement>;
    };

    const routeSpec = route('/', HomeComponent)();

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    expect(getTextContent(parent)).toBe('Home Page');
  });

  it('renders component for non-root path when path matches', () => {
    const { route, currentPath, renderer } = setup();

    const AboutComponent = ({
      el: elFn,
    }: {
      el: (
        tag: string,
        props?: Record<string, unknown>
      ) => (...children: unknown[]) => unknown;
    }): RefSpec<MockElement> => {
      return elFn('div')('About Page') as RefSpec<MockElement>;
    };

    currentPath('/about');

    const routeSpec = route('/about', AboutComponent)();

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    expect(getTextContent(parent)).toBe('About Page');
  });

  it('renders nothing when path does not match', () => {
    const { route, currentPath, renderer } = setup();

    const AboutComponent = ({
      el: elFn,
    }: {
      el: (
        tag: string,
        props?: Record<string, unknown>
      ) => (...children: unknown[]) => unknown;
    }): RefSpec<MockElement> => {
      return elFn('div')('About Page') as RefSpec<MockElement>;
    };

    currentPath('/products');

    const routeSpec = route('/about', AboutComponent)();

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    expect(parent.children.length).toBe(0);
  });

  it('reactively updates when path changes', () => {
    const { route, currentPath, renderer } = setup();

    const HomeComponent = ({
      el: elFn,
    }: {
      el: (
        tag: string,
        props?: Record<string, unknown>
      ) => (...children: unknown[]) => unknown;
    }): RefSpec<MockElement> => {
      return elFn('div')('Home Page') as RefSpec<MockElement>;
    };

    const routeSpec = route('/', HomeComponent)();

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    expect(getTextContent(parent)).toBe('Home Page');

    currentPath('/about');
    expect(parent.children.length).toBe(0);

    currentPath('/');
    expect(getTextContent(parent)).toBe('Home Page');
  });

  it('route with no children works as RefSpec', () => {
    const { route, renderer } = setup();

    const HomeComponent = ({
      el: elFn,
    }: {
      el: (
        tag: string,
        props?: Record<string, unknown>
      ) => (...children: unknown[]) => unknown;
    }): RefSpec<MockElement> => {
      return elFn('div')('Home Page') as RefSpec<MockElement>;
    };

    // Route without children can be used directly as a RefSpec
    const routeSpec = route('/', HomeComponent)();

    const parent = mountRoute(routeSpec.unwrap(), renderer);
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

    const show = Show<MockRendererConfig>().create({
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
      el: el.impl as never,
      match: match.impl,
      show: show.impl,
      currentPath,
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    return { ...env, el, route: route.impl, currentPath };
  }

  const mountRoute = (
    spec: RefSpec<MockElement>,
    renderer: { createElement: (tag: string) => MockElement }
  ): MockElement => {
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
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).parent = parentRef;
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).next = null;
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).attach(parentRef, null);
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

    const Home = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Home') as RefSpec<MockElement>;

    const About = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('About') as RefSpec<MockElement>;

    const Products = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Products') as RefSpec<MockElement>;

    const routesSpec = el.impl('div')(
      route('/', Home)().unwrap(),
      route('/about', About)().unwrap(),
      route('/products', Products)().unwrap()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('Home');
  });

  it('switches from Home to About when path changes', () => {
    const { route, el, currentPath, renderer } = setup();

    const Home = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Home') as RefSpec<MockElement>;

    const About = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('About') as RefSpec<MockElement>;

    const routesSpec = el.impl('div')(
      route('/', Home)().unwrap(),
      route('/about', About)().unwrap()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('Home');

    currentPath('/about');
    expect(getTextContent(parent)).toBe('About');
  });

  it('renders nothing when path matches no routes', () => {
    const { route, el, currentPath, renderer } = setup();

    const Home = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Home') as RefSpec<MockElement>;

    const About = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('About') as RefSpec<MockElement>;

    const routesSpec = el.impl('div')(
      route('/', Home)().unwrap(),
      route('/about', About)().unwrap()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('Home');

    currentPath('/unknown');
    expect(getTextContent(parent)).toBe('');
  });

  it('first matching route wins when multiple routes match', () => {
    const { route, el, currentPath, renderer } = setup();

    const First = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('First') as RefSpec<MockElement>;

    const Second = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Second') as RefSpec<MockElement>;

    currentPath('/test');

    const routesSpec = el.impl('div')(
      route('/test', First)().unwrap(),
      route('/test', Second)().unwrap()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('First');
  });

  it('switches between all routes as path changes', () => {
    const { route, el, currentPath, renderer } = setup();

    const Home = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Home') as RefSpec<MockElement>;

    const About = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('About') as RefSpec<MockElement>;

    const Products = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Products') as RefSpec<MockElement>;

    const routesSpec = el.impl('div')(
      route('/', Home)().unwrap(),
      route('/about', About)().unwrap(),
      route('/products', Products)().unwrap()
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

describe('params - component access to route parameters', () => {
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

    const show = Show<MockRendererConfig>().create({
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
      el: el.impl as never,
      match: match.impl,
      show: show.impl,
      currentPath,
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    return { ...env, el, route: route.impl, currentPath, computed };
  }

  const mountRoute = (
    spec: RefSpec<MockElement>,
    renderer: { createElement: (tag: string) => MockElement }
  ): MockElement => {
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
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).parent = parentRef;
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).next = null;
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).attach(parentRef, null);
    } else if ('element' in nodeRef) {
      const elementRef = nodeRef as ElementRef<MockElement>;
      elementRef.parent = parentRef;
      elementRef.next = null;
      parent.children.push(elementRef.element);
    }

    return parent;
  };

  it('provides single param via api.params()', () => {
    const { route, currentPath, renderer, computed } = setup();

    currentPath('/products/123');

    const Product = ({
      el: elFn,
      params,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      params: () => Record<string, string>;
    }) =>
      elFn('div')(
        computed(() => `Product: ${params().id}`)
      ) as RefSpec<MockElement>;

    const routeSpec = route('/products/:id', Product)();
    const parent = mountRoute(routeSpec.unwrap(), renderer);

    expect(getTextContent(parent)).toBe('Product: 123');
  });

  it('provides multiple params via api.params()', () => {
    const { route, currentPath, renderer, computed } = setup();

    currentPath('/users/42/posts/99');

    const UserPost = ({
      el: elFn,
      params,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      params: () => Record<string, string>;
    }) =>
      elFn('div')(
        computed(() => `User ${params().userId}, Post ${params().postId}`)
      ) as RefSpec<MockElement>;

    const routeSpec = route('/users/:userId/posts/:postId', UserPost)();
    const parent = mountRoute(routeSpec.unwrap(), renderer);

    expect(getTextContent(parent)).toBe('User 42, Post 99');
  });

  it('params are empty for routes without parameters', () => {
    const { route, currentPath, renderer, computed } = setup();

    currentPath('/about');

    const About = ({
      el: elFn,
      params,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      params: () => Record<string, string>;
    }) =>
      elFn('div')(
        computed(() => `Params: ${JSON.stringify(params())}`)
      ) as RefSpec<MockElement>;

    const routeSpec = route('/about', About)();
    const parent = mountRoute(routeSpec.unwrap(), renderer);

    expect(getTextContent(parent)).toBe('Params: {}');
  });

  it('params update reactively when path changes', () => {
    const { route, currentPath, renderer, computed } = setup();

    currentPath('/products/123');

    const Product = ({
      el: elFn,
      params,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      params: () => Record<string, string>;
    }) =>
      elFn('div')(
        computed(() => `Product: ${params().id}`)
      ) as RefSpec<MockElement>;

    const routeSpec = route('/products/:id', Product)();
    const parent = mountRoute(routeSpec.unwrap(), renderer);

    expect(getTextContent(parent)).toBe('Product: 123');

    currentPath('/products/456');
    expect(getTextContent(parent)).toBe('Product: 456');

    currentPath('/products/789');
    expect(getTextContent(parent)).toBe('Product: 789');
  });
});

describe('nested routes - structure and path composition', () => {
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

    const show = Show<MockRendererConfig>().create({
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
      el: el.impl as never,
      match: match.impl,
      show: show.impl,
      currentPath,
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    return { ...env, el, route: route.impl, currentPath, computed };
  }

  const mountRoute = (
    spec: RefSpec<MockElement>,
    renderer: { createElement: (tag: string) => MockElement }
  ): MockElement => {
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
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).parent = parentRef;
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).next = null;
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).attach(parentRef, null);
    } else if ('element' in nodeRef) {
      const elementRef = nodeRef as ElementRef<MockElement>;
      elementRef.parent = parentRef;
      elementRef.next = null;
      parent.children.push(elementRef.element);
    }

    return parent;
  };

  it('child path is relative to parent', () => {
    const { route, currentPath, renderer } = setup();

    currentPath('/about');

    const App = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) => elFn('div')('App', outlet()) as RefSpec<MockElement>;

    const About = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('About') as RefSpec<MockElement>;

    // Parent receives result of calling child route (leaf has no children)
    const routeSpec = route('/', App)(route('about', About)());

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    expect(getTextContent(parent)).toContain('About');
  });

  it('nested child paths compose correctly', () => {
    const { route, currentPath, renderer } = setup();

    currentPath('/products/123');

    const App = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) => elFn('div')('App', outlet()) as RefSpec<MockElement>;

    const Products = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) => elFn('div')('Products', outlet()) as RefSpec<MockElement>;

    const Product = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Product') as RefSpec<MockElement>;

    // Nested routes - each level calls its builder with children
    const routeSpec = route(
      '/',
      App
    )(route('products', Products)(route(':id', Product)()));

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    expect(getTextContent(parent)).toContain('Product');
  });

  it('handles multiple nesting levels', () => {
    const { route, currentPath, renderer } = setup();

    currentPath('/admin/users/42/settings');

    const App = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) => elFn('div')('App', outlet()) as RefSpec<MockElement>;

    const Admin = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) => elFn('div')('Admin', outlet()) as RefSpec<MockElement>;

    const Users = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) => elFn('div')('Users', outlet()) as RefSpec<MockElement>;

    const UserDetail = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) => elFn('div')('UserDetail', outlet()) as RefSpec<MockElement>;

    const Settings = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Settings') as RefSpec<MockElement>;

    // Deep nesting - each level builds its children
    const routeSpec = route(
      '/',
      App
    )(
      route(
        'admin',
        Admin
      )(
        route(
          'users',
          Users
        )(route(':userId', UserDetail)(route('settings', Settings)()))
      )
    );

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    expect(getTextContent(parent)).toContain('Settings');
  });

  it('parent matches when child path is active', () => {
    const { route, currentPath, renderer } = setup();

    currentPath('/products/123');

    const App = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) => elFn('div')('App-Layout', outlet()) as RefSpec<MockElement>;

    const Products = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) => elFn('div')('Products-Layout', outlet()) as RefSpec<MockElement>;

    const Product = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Product-Content') as RefSpec<MockElement>;

    // Nested routes - parents should match when child is active
    const routeSpec = route(
      '/',
      App
    )(route('products', Products)(route(':id', Product)()));

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    const content = getTextContent(parent);

    // Both parent layouts and child content should be present
    expect(content).toContain('App-Layout');
    expect(content).toContain('Products-Layout');
    expect(content).toContain('Product-Content');
  });

  it('params work with nested parameterized routes', () => {
    const { route, currentPath, renderer, computed } = setup();

    currentPath('/users/42/posts/99');

    const App = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) => elFn('div')('App', outlet()) as RefSpec<MockElement>;

    const Users = ({
      el: elFn,
      params,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      params: () => Record<string, string>;
      outlet: () => unknown;
    }) =>
      elFn('div')(
        computed(() => `User: ${params().userId}`),
        outlet()
      ) as RefSpec<MockElement>;

    const Posts = ({
      el: elFn,
      params,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      params: () => Record<string, string>;
    }) =>
      elFn('div')(
        computed(() => `Post: ${params().postId}`)
      ) as RefSpec<MockElement>;

    // Nested parameterized routes
    const routeSpec = route(
      '/',
      App
    )(route('users/:userId', Users)(route('posts/:postId', Posts)()));

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    const content = getTextContent(parent);

    expect(content).toContain('User: 42');
    expect(content).toContain('Post: 99');
  });
});

describe('programmatic navigation', () => {
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

    const show = Show<MockRendererConfig>().create({
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
      el: el.impl as never,
      match: match.impl,
      show: show.impl,
      currentPath,
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    return { ...env, el, route: route.impl, currentPath, computed };
  }

  const mountRoute = (
    spec: RefSpec<MockElement>,
    renderer: { createElement: (tag: string) => MockElement }
  ): MockElement => {
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
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).parent = parentRef;
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).next = null;
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).attach(parentRef, null);
    } else if ('element' in nodeRef) {
      const elementRef = nodeRef as ElementRef<MockElement>;
      elementRef.parent = parentRef;
      elementRef.next = null;
      parent.children.push(elementRef.element);
    }

    return parent;
  };

  it('navigate updates current route', () => {
    const { route, el, renderer } = setup();

    let navigateFn: ((path: string) => void) | undefined;

    const Home = ({
      el: elFn,
      navigate,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      navigate: (path: string) => void;
    }) => {
      navigateFn = navigate;
      return elFn('div')('Home') as RefSpec<MockElement>;
    };

    const About = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('About') as RefSpec<MockElement>;

    const routesSpec = el.impl('div')(
      route('/', Home)().unwrap(),
      route('/about', About)().unwrap()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('Home');

    if (!navigateFn) throw new Error('navigate not set');
    navigateFn('/about');
    expect(getTextContent(parent)).toBe('About');
  });

  it('navigate works with parameterized paths', () => {
    const { route, el, renderer, computed } = setup();

    let navigateFn: ((path: string) => void) | undefined;

    const Home = ({
      el: elFn,
      navigate,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      navigate: (path: string) => void;
    }) => {
      navigateFn = navigate;
      return elFn('div')('Home') as RefSpec<MockElement>;
    };

    const Product = ({
      el: elFn,
      params,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      params: () => Record<string, string>;
    }) =>
      elFn('div')(
        computed(() => `Product: ${params().id}`)
      ) as RefSpec<MockElement>;

    const routesSpec = el.impl('div')(
      route('/', Home)().unwrap(),
      route('/products/:id', Product)().unwrap()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('Home');

    if (!navigateFn) throw new Error('navigate not set');
    navigateFn('/products/123');
    expect(getTextContent(parent)).toBe('Product: 123');
  });

  it('navigate updates browser history', () => {
    const { route, renderer } = setup();

    const pushStateSpy = { calls: [] as Array<[unknown, string, string]> };
    const originalPushState = window.history.pushState.bind(window.history);
    window.history.pushState = function (
      state: unknown,
      title: string,
      url: string
    ) {
      pushStateSpy.calls.push([state, title, url]);
      return originalPushState(state, title, url);
    };

    let navigateFn: ((path: string) => void) | undefined;

    const Home = ({
      el: elFn,
      navigate,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      navigate: (path: string) => void;
    }) => {
      navigateFn = navigate;
      return elFn('div')('Home') as RefSpec<MockElement>;
    };

    const routeSpec = route('/', Home)();
    mountRoute(routeSpec.unwrap(), renderer);

    if (!navigateFn) throw new Error('navigate not set');
    navigateFn('/about');

    expect(pushStateSpy.calls.length).toBe(1);
    expect(pushStateSpy.calls[0]?.[2]).toBe('/about');

    window.history.pushState = originalPushState;
  });

  it('multiple navigations work correctly', () => {
    const { route, el, renderer } = setup();

    let navigateFn: ((path: string) => void) | undefined;

    const Home = ({
      el: elFn,
      navigate,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      navigate: (path: string) => void;
    }) => {
      navigateFn = navigate;
      return elFn('div')('Home') as RefSpec<MockElement>;
    };

    const About = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('About') as RefSpec<MockElement>;

    const Products = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Products') as RefSpec<MockElement>;

    const routesSpec = el.impl('div')(
      route('/', Home)().unwrap(),
      route('/about', About)().unwrap(),
      route('/products', Products)().unwrap()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('Home');

    if (!navigateFn) throw new Error('navigate not set');
    navigateFn('/about');
    expect(getTextContent(parent)).toBe('About');

    navigateFn('/products');
    expect(getTextContent(parent)).toBe('Products');

    navigateFn('/');
    expect(getTextContent(parent)).toBe('Home');
  });

  it('components are recreated on each navigation to the route', () => {
    const { route, el, renderer, computed } = setup();

    let navigateFn: ((path: string) => void) | undefined;
    let componentCreationCount = 0;

    const Home = ({
      el: elFn,
      navigate,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      navigate: (path: string) => void;
    }) => {
      // Component body runs each time the route matches
      componentCreationCount++;
      navigateFn = navigate;
      return elFn('div')(
        computed(() => {
          return 'Home';
        })
      ) as RefSpec<MockElement>;
    };

    const About = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('About') as RefSpec<MockElement>;

    const routesSpec = el.impl('div')(
      route('/', Home)().unwrap(),
      route('/about', About)().unwrap()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(componentCreationCount).toBe(1); // Created once on initial render

    if (!navigateFn) throw new Error('navigate not set');
    navigateFn('/about');
    expect(getTextContent(parent)).toBe('About');
    expect(componentCreationCount).toBe(1); // Home destroyed, count unchanged

    navigateFn('/');
    expect(getTextContent(parent)).toBe('Home');
    expect(componentCreationCount).toBe(2); // Home recreated on return
  });
});

describe('wildcard routes - catch-all behavior', () => {
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

    const show = Show<MockRendererConfig>().create({
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
      el: el.impl as never,
      match: match.impl,
      show: show.impl,
      currentPath,
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    return { ...env, el, route: route.impl, currentPath };
  }

  const mountRoute = (
    spec: RefSpec<MockElement>,
    renderer: { createElement: (tag: string) => MockElement }
  ): MockElement => {
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
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).parent = parentRef;
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).next = null;
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).attach(parentRef, null);
    } else if ('element' in nodeRef) {
      const elementRef = nodeRef as ElementRef<MockElement>;
      elementRef.parent = parentRef;
      elementRef.next = null;
      parent.children.push(elementRef.element);
    }

    return parent;
  };

  it('wildcard matches any path when no other route matches', () => {
    const { route, el, currentPath, renderer } = setup();

    currentPath('/unknown');

    const Home = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Home') as RefSpec<MockElement>;

    const NotFound = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Not Found') as RefSpec<MockElement>;

    const routesSpec = el.impl('div')(
      route('/', Home)().unwrap(),
      route('*', NotFound)().unwrap()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('Not Found');
  });

  it('wildcard does not match when earlier route matches', () => {
    const { route, el, currentPath, renderer } = setup();

    currentPath('/about');

    const About = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('About') as RefSpec<MockElement>;

    const NotFound = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Not Found') as RefSpec<MockElement>;

    const routesSpec = el.impl('div')(
      route('/about', About)().unwrap(),
      route('*', NotFound)().unwrap()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('About');
  });

  it('wildcard works with nested routes', () => {
    const { route, currentPath, renderer } = setup();

    currentPath('/unknown');

    const App = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) => elFn('div')('App', outlet()) as RefSpec<MockElement>;

    const Home = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Home') as RefSpec<MockElement>;

    const NotFound = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Not Found') as RefSpec<MockElement>;

    const routeSpec = route('/', App)(
      route('', Home)(),
      route('*', NotFound)()
    );

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    expect(getTextContent(parent)).toContain('Not Found');
  });

  it('wildcard matches multi-segment paths', () => {
    const { route, el, currentPath, renderer } = setup();

    currentPath('/some/deep/unknown/path');

    const Home = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Home') as RefSpec<MockElement>;

    const NotFound = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Not Found') as RefSpec<MockElement>;

    const routesSpec = el.impl('div')(
      route('/', Home)().unwrap(),
      route('*', NotFound)().unwrap()
    );

    const parent = mountRoute(routesSpec, renderer);
    expect(getTextContent(parent)).toBe('Not Found');
  });
});

describe('outlet - parent components render matched children', () => {
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

    const show = Show<MockRendererConfig>().create({
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
      el: el.impl as never,
      match: match.impl,
      show: show.impl,
      currentPath,
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      onCleanup: env.onCleanup,
    });

    return { ...env, el, route: route.impl, currentPath, computed };
  }

  const mountRoute = (
    spec: RefSpec<MockElement>,
    renderer: { createElement: (tag: string) => MockElement }
  ): MockElement => {
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
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).parent = parentRef;
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).next = null;
      (
        nodeRef as {
          parent: unknown;
          next: unknown;
          attach: (parent: unknown, next: unknown) => void;
        }
      ).attach(parentRef, null);
    } else if ('element' in nodeRef) {
      const elementRef = nodeRef as ElementRef<MockElement>;
      elementRef.parent = parentRef;
      elementRef.next = null;
      parent.children.push(elementRef.element);
    }

    return parent;
  };

  it('layout renders matched child via outlet', () => {
    const { route, currentPath, renderer } = setup();

    currentPath('/about');

    const Layout = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) =>
      elFn('div')(
        elFn('header')('Header'),
        outlet(),
        elFn('footer')('Footer')
      ) as RefSpec<MockElement>;

    const About = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('About Page') as RefSpec<MockElement>;

    const routeSpec = route('/', Layout)(route('about', About)());

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    const content = getTextContent(parent);

    expect(content).toContain('Header');
    expect(content).toContain('About Page');
    expect(content).toContain('Footer');
  });

  it('outlet switches child when path changes', () => {
    const { route, currentPath, renderer } = setup();

    currentPath('/about');

    const Layout = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) =>
      elFn('div')(
        elFn('header')('Header'),
        outlet(),
        elFn('footer')('Footer')
      ) as RefSpec<MockElement>;

    const About = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('About Page') as RefSpec<MockElement>;

    const Products = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Products Page') as RefSpec<MockElement>;

    const routeSpec = route('/', Layout)(
      route('about', About)(),
      route('products', Products)()
    );

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    expect(getTextContent(parent)).toContain('About Page');
    expect(getTextContent(parent)).not.toContain('Products Page');

    currentPath('/products');
    expect(getTextContent(parent)).toContain('Products Page');
    expect(getTextContent(parent)).not.toContain('About Page');

    currentPath('/about');
    expect(getTextContent(parent)).toContain('About Page');
    expect(getTextContent(parent)).not.toContain('Products Page');
  });

  it('outlet renders nothing when no child matches', () => {
    const { route, currentPath, renderer } = setup();

    currentPath('/unknown');

    const Layout = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) =>
      elFn('div')(
        elFn('header')('Header'),
        outlet(),
        elFn('footer')('Footer')
      ) as RefSpec<MockElement>;

    const About = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('About Page') as RefSpec<MockElement>;

    const routeSpec = route('/', Layout)(route('about', About)());

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    const content = getTextContent(parent);

    expect(content).toContain('Header');
    expect(content).toContain('Footer');
    expect(content).not.toContain('About Page');
  });

  it('multiple outlet levels work', () => {
    const { route, currentPath, renderer } = setup();

    currentPath('/admin/users/settings');

    const AppLayout = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) =>
      elFn('div')(elFn('nav')('Main Nav'), outlet()) as RefSpec<MockElement>;

    const AdminLayout = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) =>
      elFn('div')(
        elFn('aside')('Admin Sidebar'),
        outlet()
      ) as RefSpec<MockElement>;

    const UsersLayout = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) => elFn('div')(elFn('h1')('Users'), outlet()) as RefSpec<MockElement>;

    const Settings = ({
      el: elFn,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
    }) => elFn('div')('Settings Page') as RefSpec<MockElement>;

    const routeSpec = route(
      '/',
      AppLayout
    )(
      route(
        'admin',
        AdminLayout
      )(route('users', UsersLayout)(route('settings', Settings)()))
    );

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    const content = getTextContent(parent);

    expect(content).toContain('Main Nav');
    expect(content).toContain('Admin Sidebar');
    expect(content).toContain('Users');
    expect(content).toContain('Settings Page');
  });

  it('outlet child receives composed params from all parent routes', () => {
    const { route, currentPath, renderer, computed } = setup();

    currentPath('/users/42/posts/99/edit');

    const App = ({
      el: elFn,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      outlet: () => unknown;
    }) => elFn('div')(outlet()) as RefSpec<MockElement>;

    const UserSection = ({
      el: elFn,
      params,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      params: () => Record<string, string>;
      outlet: () => unknown;
    }) =>
      elFn('div')(
        computed(() => `User: ${params().userId}`),
        outlet()
      ) as RefSpec<MockElement>;

    const PostSection = ({
      el: elFn,
      params,
      outlet,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      params: () => Record<string, string>;
      outlet: () => unknown;
    }) =>
      elFn('div')(
        computed(() => `Post: ${params().postId}`),
        outlet()
      ) as RefSpec<MockElement>;

    const EditPage = ({
      el: elFn,
      params,
    }: {
      el: (tag: string) => (...children: unknown[]) => unknown;
      params: () => Record<string, string>;
    }) =>
      elFn('div')(
        computed(
          () => `Editing User ${params().userId}, Post ${params().postId}`
        )
      ) as RefSpec<MockElement>;

    const routeSpec = route(
      '/',
      App
    )(
      route(
        'users/:userId',
        UserSection
      )(route('posts/:postId', PostSection)(route('edit', EditPage)()))
    );

    const parent = mountRoute(routeSpec.unwrap(), renderer);
    const content = getTextContent(parent);

    expect(content).toContain('User: 42');
    expect(content).toContain('Post: 99');
    expect(content).toContain('Editing User 42, Post 99');
  });
});
