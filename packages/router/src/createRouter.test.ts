/**
 * Tests for createRouter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRouter } from './createRouter';
import type { ViewApi, RouteApi, RouteContext } from './createRouter';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import type { SealedSpec } from '@lattice/view/types';
import { STATUS_SEALED_SPEC } from '@lattice/view/types';

// Helper function to create mock computed (used outside beforeEach)
const createMockComputed = <T>(fn: () => T) => {
  const computedFn = (() => fn()) as (() => T) & { peek: () => T };
  computedFn.peek = fn;
  return computedFn;
};

describe('createRouter', () => {
  let mockViewApi: ViewApi<DOMRendererConfig>;
  let originalWindow: typeof globalThis.window;
  let originalLocation: Location;
  let originalHistory: History;

  beforeEach(() => {
    // Save original window object
    originalWindow = globalThis.window;
    originalLocation = globalThis.window?.location;
    originalHistory = globalThis.window?.history;

    // Create mock signal and computed with proper typing
    const mockSignal = <T>(value: T): ReturnType<ViewApi<DOMRendererConfig>['signal']> => {
      let current = value;
      const fn = ((newValue?: T) => {
        if (newValue !== undefined) {
          current = newValue;
        }
        return current;
      }) as ReturnType<ViewApi<DOMRendererConfig>['signal']>;
      fn.peek = () => current;
      return fn;
    };

    const mockComputed = <T>(fn: () => T): ReturnType<ViewApi<DOMRendererConfig>['computed']> => {
      const computedFn = (() => fn()) as ReturnType<ViewApi<DOMRendererConfig>['computed']>;
      computedFn.peek = fn;
      return computedFn;
    };

    mockViewApi = {
      signal: mockSignal as ViewApi<DOMRendererConfig>['signal'],
      computed: mockComputed as ViewApi<DOMRendererConfig>['computed'],
      el: (() => {}) as unknown as ViewApi<DOMRendererConfig>['el'],
      match: (() => {}) as unknown as ViewApi<DOMRendererConfig>['match'],
      show: (() => {}) as unknown as ViewApi<DOMRendererConfig>['show'],
    };
  });

  afterEach(() => {
    // Restore original window
    if (originalWindow) {
      globalThis.window = originalWindow;
    }
  });

  describe('initialization', () => {
    it('should create router with default path when no config provided', () => {
      const router = createRouter(mockViewApi);
      expect(router.currentPath()).toBe('/');
    });

    it('should use initialPath from config', () => {
      const router = createRouter(mockViewApi, { initialPath: '/test' });
      expect(router.currentPath()).toBe('/test');
    });

    it('should read from window.location when available', () => {
      // Mock window.location
      Object.defineProperty(globalThis, 'window', {
        value: {
          location: {
            pathname: '/browser',
            search: '?query=1',
            hash: '#section',
          },
          history: originalHistory,
        },
        writable: true,
        configurable: true,
      });

      const router = createRouter(mockViewApi);
      expect(router.currentPath()).toBe('/browser?query=1#section');
    });

    it('should prefer initialPath over window.location', () => {
      // Mock window.location
      Object.defineProperty(globalThis, 'window', {
        value: {
          location: {
            pathname: '/browser',
            search: '',
            hash: '',
          },
          history: originalHistory,
        },
        writable: true,
        configurable: true,
      });

      const router = createRouter(mockViewApi, { initialPath: '/override' });
      expect(router.currentPath()).toBe('/override');
    });
  });

  describe('navigate', () => {
    it('should update currentPath signal', () => {
      const router = createRouter(mockViewApi, { initialPath: '/' });
      router.navigate('/new-path');
      expect(router.currentPath()).toBe('/new-path');
    });

    it('should update window.history when available', () => {
      const pushStateCalls: Array<{ path: string }> = [];

      Object.defineProperty(globalThis, 'window', {
        value: {
          location: originalLocation,
          history: {
            ...originalHistory,
            pushState: (_state: unknown, _title: string, path: string) => {
              pushStateCalls.push({ path });
            },
          },
        },
        writable: true,
        configurable: true,
      });

      const router = createRouter(mockViewApi, { initialPath: '/' });
      router.navigate('/test');

      expect(pushStateCalls).toHaveLength(1);
      expect(pushStateCalls[0]?.path).toBe('/test');
    });

    it('should not crash when window.history is unavailable', () => {
      // Remove window
      Object.defineProperty(globalThis, 'window', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const router = createRouter(mockViewApi, { initialPath: '/' });
      expect(() => router.navigate('/test')).not.toThrow();
      expect(router.currentPath()).toBe('/test');
    });
  });

  describe('route method', () => {
    beforeEach(() => {
      // Mock show() to return a simple RefSpec wrapper
      mockViewApi.show = ((
        _condition: unknown,
        refSpec: unknown
      ) => refSpec) as unknown as ViewApi<DOMRendererConfig>['show'];

      // Mock match() - not used in route() but needed for type safety
      mockViewApi.match = (() => {}) as unknown as ViewApi<DOMRendererConfig>['match'];
    });

    it('should accept a path and connected component', () => {
      const router = createRouter(mockViewApi, { initialPath: '/' });

      const mockConnected: import('./createRouter').ConnectedComponent<DOMRendererConfig, Record<string, never>> = {
        _isConnected: true,
        userProps: {},
        instantiate: () => ({
          status: STATUS_SEALED_SPEC,
          create: () => ({ status: 1, element: document.createElement('div'), parent: null, prev: null, next: null, firstChild: null, lastChild: null })
        })
      };

      const routeFactory = router.route('/', mockConnected);
      expect(typeof routeFactory).toBe('function');

      const routeSpec = routeFactory();
      expect(routeSpec).toBeDefined();
      expect(routeSpec.status).toBe(32); // STATUS_ROUTE_SPEC
    });

    it('should extract params from path patterns', () => {
      const router = createRouter(mockViewApi, { initialPath: '/users/123' });

      let capturedParams: Record<string, string> = {};

      const mockConnected: import('./createRouter').ConnectedComponent<DOMRendererConfig, Record<string, never>> = {
        _isConnected: true,
        userProps: {},
        instantiate: (routeContext) => {
          capturedParams = routeContext.params();
          return {
            status: STATUS_SEALED_SPEC,
            create: () => ({ status: 1, element: document.createElement('div'), parent: null, prev: null, next: null, firstChild: null, lastChild: null })
          };
        }
      };

      const routeFactory = router.route('/users/:id', mockConnected);
      routeFactory();

      expect(capturedParams).toEqual({ id: '123' });
    });

    it('should pass null children when route has no children', () => {
      const router = createRouter(mockViewApi, { initialPath: '/' });

      let capturedChildren: unknown = undefined;

      const mockConnected: import('./createRouter').ConnectedComponent<DOMRendererConfig, Record<string, never>> = {
        _isConnected: true,
        userProps: {},
        instantiate: (routeContext) => {
          capturedChildren = routeContext.children;
          return {
            status: STATUS_SEALED_SPEC,
            create: () => ({ status: 1, element: document.createElement('div'), parent: null, prev: null, next: null, firstChild: null, lastChild: null })
          };
        }
      };

      const routeFactory = router.route('/', mockConnected);
      routeFactory();

      expect(capturedChildren).toBeNull();
    });

    it('should compose nested route paths', () => {
      const router = createRouter(mockViewApi, { initialPath: '/products/123' });

      let childParams: Record<string, string> = {};

      const childConnected: import('./createRouter').ConnectedComponent<DOMRendererConfig, Record<string, never>> = {
        _isConnected: true,
        userProps: {},
        instantiate: (routeContext) => {
          childParams = routeContext.params();
          return {
            status: STATUS_SEALED_SPEC,
            create: () => ({ status: 1, element: document.createElement('div'), parent: null, prev: null, next: null, firstChild: null, lastChild: null })
          };
        }
      };

      const parentConnected: import('./createRouter').ConnectedComponent<DOMRendererConfig, Record<string, never>> = {
        _isConnected: true,
        userProps: {},
        instantiate: () => {
          return {
            status: STATUS_SEALED_SPEC,
            create: () => ({ status: 1, element: document.createElement('div'), parent: null, prev: null, next: null, firstChild: null, lastChild: null })
          };
        }
      };

      const childRoute = router.route(':id', childConnected)();
      const parentRoute = router.route('/products', parentConnected)(childRoute);

      expect(parentRoute).toBeDefined();
      expect(childParams).toEqual({ id: '123' });
    });
  });

  describe('connect method', () => {
    // Helper to create a mock SealedSpec
    const createMockSealedSpec = (): SealedSpec<HTMLElement> => ({
      status: STATUS_SEALED_SPEC,
      create: () => ({ status: 1, element: document.createElement('div'), parent: null, prev: null, next: null, firstChild: null, lastChild: null })
    });

    it('should return a function that accepts user props', () => {
      const router = createRouter(mockViewApi);

      const wrapper = (): ((_userProps: { theme: string }) => SealedSpec<HTMLElement>) => {
        return () => createMockSealedSpec();
      };

      const connectedFactory = router.connect(wrapper);
      expect(typeof connectedFactory).toBe('function');
    });

    it('should return a ConnectedComponent when called with user props', () => {
      const router = createRouter(mockViewApi);

      const wrapper = (): ((_userProps: { theme: string }) => SealedSpec<HTMLElement>) => {
        return () => createMockSealedSpec();
      };

      const connectedFactory = router.connect(wrapper);
      const connected = connectedFactory({ theme: 'dark' });

      expect(connected).toHaveProperty('_isConnected', true);
      expect(connected).toHaveProperty('userProps');
      expect(connected.userProps).toEqual({ theme: 'dark' });
      expect(connected).toHaveProperty('instantiate');
      expect(typeof connected.instantiate).toBe('function');
    });

    it('should provide route API to wrapper function', () => {
      const router = createRouter(mockViewApi, { initialPath: '/test' });
      let capturedRouteApi: RouteApi | null = null;

      const wrapper = (routeApi: RouteApi): (() => SealedSpec<HTMLElement>) => {
        capturedRouteApi = routeApi;
        return () => createMockSealedSpec();
      };

      const connectedFactory = router.connect(wrapper);
      const connected = connectedFactory({});

      // Instantiate to trigger wrapper call
      const mockParams = createMockComputed(() => ({}));
      connected.instantiate({ children: null, params: mockParams });

      // TypeScript assertion - we know this will be set after instantiate
      expect(capturedRouteApi).not.toBeNull();
      const api = capturedRouteApi as unknown as RouteApi;
      expect(api).toHaveProperty('navigate');
      expect(api).toHaveProperty('currentPath');
      expect(typeof api.navigate).toBe('function');
      expect(typeof api.currentPath).toBe('function');
    });

    it('should provide route context to instantiate', () => {
      const router = createRouter(mockViewApi);
      let capturedRouteContext: RouteContext<DOMRendererConfig> | null = null;

      const wrapper = (
        _routeApi: RouteApi,
        routeContext: RouteContext<DOMRendererConfig>
      ): (() => SealedSpec<HTMLElement>) => {
        capturedRouteContext = routeContext;
        return () => createMockSealedSpec();
      };

      const connectedFactory = router.connect(wrapper);
      const connected = connectedFactory({});

      const mockParams = createMockComputed(() => ({ id: '123' }));
      const routeContext: RouteContext<DOMRendererConfig> = {
        children: null,
        params: mockParams
      };

      connected.instantiate(routeContext);

      // TypeScript assertion - we know this will be set after instantiate
      expect(capturedRouteContext).not.toBeNull();
      const context = capturedRouteContext as unknown as RouteContext<DOMRendererConfig>;
      expect(context).toHaveProperty('children', null);
      expect(context).toHaveProperty('params');
      expect(context.params()).toEqual({ id: '123' });
    });

    it('should pass user props to component factory', () => {
      const router = createRouter(mockViewApi);
      let capturedUserProps: Record<string, unknown> | null = null;

      const wrapper = (): ((userProps: Record<string, unknown>) => SealedSpec<HTMLElement>) => {
        return (userProps: Record<string, unknown>) => {
          capturedUserProps = userProps;
          return createMockSealedSpec();
        };
      };

      const connectedFactory = router.connect(wrapper);
      const connected = connectedFactory({ theme: 'dark', title: 'App' });

      const mockParams = createMockComputed(() => ({}));
      connected.instantiate({ children: null, params: mockParams });

      expect(capturedUserProps).toEqual({ theme: 'dark', title: 'App' });
    });

    it('should return SealedSpec from instantiate', () => {
      const router = createRouter(mockViewApi);

      const mockSealedSpec = createMockSealedSpec();

      const wrapper = (): (() => SealedSpec<HTMLElement>) => {
        return () => mockSealedSpec;
      };

      const connectedFactory = router.connect(wrapper);
      const connected = connectedFactory({});
      const mockParams = createMockComputed(() => ({}));
      const result = connected.instantiate({ children: null, params: mockParams });

      expect(result).toBe(mockSealedSpec);
    });

    it('should work with create() pattern integration', () => {
      const router = createRouter(mockViewApi);

      // Simulate the create() pattern from the requirements
      const wrapper = (
        { currentPath }: RouteApi,
        _routeContext: RouteContext<DOMRendererConfig>
      ): ((userProps: { theme: string; title: string }) => SealedSpec<HTMLElement>) => {
        return (userProps: { theme: string; title: string }) => ({
          status: STATUS_SEALED_SPEC,
          create: () => {
            // In real usage, this would construct the component using el()
            const div = document.createElement('div');
            div.className = userProps.theme;
            div.textContent = `${userProps.title} - ${currentPath()}`;
            return { status: 1, element: div, parent: null, prev: null, next: null, firstChild: null, lastChild: null };
          }
        });
      };

      const connectedFactory = router.connect(wrapper);
      const AppLayout = connectedFactory({ theme: 'dark', title: 'My App' });

      expect(AppLayout._isConnected).toBe(true);
      expect(AppLayout.userProps).toEqual({ theme: 'dark', title: 'My App' });

      const mockParams = createMockComputed(() => ({ id: '1' }));
      const sealedSpec = AppLayout.instantiate({ children: null, params: mockParams });
      expect(sealedSpec.status).toBe(STATUS_SEALED_SPEC);
      expect(typeof sealedSpec.create).toBe('function');
    });

    it('should allow navigate and currentPath to be used in wrapper', () => {
      const router = createRouter(mockViewApi, { initialPath: '/initial' });
      let usedNavigate = false;
      let readPath = '';

      const wrapper = (
        { navigate, currentPath }: RouteApi
      ): (() => SealedSpec<HTMLElement>) => {
        return () => {
          readPath = currentPath();
          navigate('/new-path');
          usedNavigate = true;
          return createMockSealedSpec();
        };
      };

      const connectedFactory = router.connect(wrapper);
      const connected = connectedFactory({});
      const mockParams = createMockComputed(() => ({}));
      connected.instantiate({ children: null, params: mockParams });

      expect(usedNavigate).toBe(true);
      expect(readPath).toBe('/initial');
      expect(router.currentPath()).toBe('/new-path');
    });
  });

  describe('currentPath as computed', () => {
    it('should expose currentPath as a computed (read-only)', () => {
      const router = createRouter(mockViewApi, { initialPath: '/test' });

      expect(router.currentPath()).toBe('/test');
      expect(typeof router.currentPath.peek).toBe('function');
      expect(router.currentPath.peek()).toBe('/test');
    });

    it('should update currentPath computed when navigating', () => {
      const router = createRouter(mockViewApi, { initialPath: '/initial' });

      expect(router.currentPath()).toBe('/initial');

      router.navigate('/updated');

      expect(router.currentPath()).toBe('/updated');
      expect(router.currentPath.peek()).toBe('/updated');
    });
  });

  describe('type exports', () => {
    it('should export router instance with correct shape', () => {
      const router = createRouter(mockViewApi);
      expect(router).toHaveProperty('route');
      expect(router).toHaveProperty('connect');
      expect(router).toHaveProperty('navigate');
      expect(router).toHaveProperty('currentPath');
      expect(typeof router.route).toBe('function');
      expect(typeof router.connect).toBe('function');
      expect(typeof router.navigate).toBe('function');
      expect(typeof router.currentPath).toBe('function');
    });
  });
});
