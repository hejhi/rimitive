/**
 * Tests for createRouter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRouter } from './createRouter';
import type {
  ViewApi,
  RouteContext,
  ConnectedComponent,
} from './createRouter';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { RefSpec, STATUS_REF_SPEC } from '@lattice/view/types';

// Helper function to create mock computed (used outside beforeEach)
const createMockComputed = <T>(fn: () => T) => {
  const computedFn = (() => fn()) as (() => T) & { peek: () => T };
  computedFn.peek = fn;
  return computedFn;
};

describe('createRouter', () => {
  let mockViewApi: ViewApi<DOMAdapterConfig>;
  let originalWindow: typeof globalThis.window;
  let originalLocation: Location;
  let originalHistory: History;

  beforeEach(() => {
    // Save original window object
    originalWindow = globalThis.window;
    originalLocation = globalThis.window?.location;
    originalHistory = globalThis.window?.history;

    // Create mock signal and computed with proper typing
    const mockSignal = <T>(
      value: T
    ): ReturnType<ViewApi<DOMAdapterConfig>['signal']> => {
      let current = value;
      const fn = ((newValue?: T) => {
        if (newValue !== undefined) {
          current = newValue;
        }
        return current;
      }) as ReturnType<ViewApi<DOMAdapterConfig>['signal']>;
      fn.peek = () => current;
      return fn;
    };

    const mockComputed = <T>(
      fn: () => T
    ): ReturnType<ViewApi<DOMAdapterConfig>['computed']> => {
      const computedFn = (() => fn()) as ReturnType<
        ViewApi<DOMAdapterConfig>['computed']
      >;
      computedFn.peek = fn;
      return computedFn;
    };

    mockViewApi = {
      signal: mockSignal as ViewApi<DOMAdapterConfig>['signal'],
      computed: mockComputed as ViewApi<DOMAdapterConfig>['computed'],
      el: (() => {}) as unknown as ViewApi<DOMAdapterConfig>['el'],
      match: (() => {}) as unknown as ViewApi<DOMAdapterConfig>['match'],
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
          addEventListener: () => {},
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
          addEventListener: () => {},
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
          addEventListener: () => {},
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
      // Mock match() to call the reactive and pass its result to the matcher
      mockViewApi.match = (<T>(reactive: () => T, matcher: (value: T) => unknown) => {
        // Call the reactive to get the actual match result (with real params)
        const matchResult = reactive();
        const result = matcher(matchResult);
        // Return a RefSpec wrapper around the result
        return result ?? {
          status: STATUS_REF_SPEC,
          create: () => ({
            status: 1,
            element: null,
            parent: null,
            prev: null,
            next: null,
            firstChild: null,
            lastChild: null,
          }),
        };
      }) as unknown as ViewApi<DOMAdapterConfig>['match'];
    });

    it('should accept a path and connected component', () => {
      const router = createRouter(mockViewApi, { initialPath: '/' });

      const mockConnected: ConnectedComponent<DOMAdapterConfig> = () =>
        ({
          status: STATUS_REF_SPEC,
          create: () => ({
            status: 1,
            element: document.createElement('div'),
            parent: null,
            prev: null,
            next: null,
            firstChild: null,
            lastChild: null,
          }),
        }) as RefSpec<HTMLElement>;

      const routeFactory = router.route('/', mockConnected);
      expect(typeof routeFactory).toBe('function');

      const routeSpec = routeFactory();
      expect(routeSpec).toBeDefined();
      expect(routeSpec.status).toBe(32); // STATUS_ROUTE_SPEC
    });

    it('should extract params from path patterns', () => {
      const router = createRouter(mockViewApi, { initialPath: '/users/123' });

      let capturedParams: Record<string, string> = {};

      const mockConnected = (routeContext: RouteContext<DOMAdapterConfig>) => {
        capturedParams = routeContext.params();
        return {
          status: STATUS_REF_SPEC,
          create: () => ({
            status: 1,
            element: document.createElement('div'),
            parent: null,
            prev: null,
            next: null,
            firstChild: null,
            lastChild: null,
          }),
        } as RefSpec<HTMLElement>;
      };

      const routeFactory = router.route('/users/:id', mockConnected);
      routeFactory();

      expect(capturedParams).toEqual({ id: '123' });
    });

    it('should pass null children when route has no children', () => {
      const router = createRouter(mockViewApi, { initialPath: '/' });

      let capturedChildren: unknown = undefined;

      const mockConnected: ConnectedComponent<DOMAdapterConfig> = (
        routeContext: RouteContext<DOMAdapterConfig>
      ) => {
        capturedChildren = routeContext.children;
        return {
          status: STATUS_REF_SPEC,
          create: () => ({
            status: 1,
            element: document.createElement('div'),
            parent: null,
            prev: null,
            next: null,
            firstChild: null,
            lastChild: null,
          }),
        } as RefSpec<HTMLElement>;
      };

      const routeFactory = router.route('/', mockConnected);
      routeFactory();

      expect(capturedChildren).toBeNull();
    });

    it('should compose nested route paths', () => {
      const router = createRouter(mockViewApi, {
        initialPath: '/products/123',
      });

      let childParams: Record<string, string> = {};

      const childConnected: ConnectedComponent<DOMAdapterConfig> = (
        routeContext: RouteContext<DOMAdapterConfig>
      ) => {
        childParams = routeContext.params();
        return {
          status: STATUS_REF_SPEC,
          create: () => ({
            status: 1,
            element: document.createElement('div'),
            parent: null,
            prev: null,
            next: null,
            firstChild: null,
            lastChild: null,
          }),
        } as RefSpec<HTMLElement>;
      };

      const parentConnected: ConnectedComponent<DOMAdapterConfig> = () => {
        return {
          status: STATUS_REF_SPEC,
          create: () => ({
            status: 1,
            element: document.createElement('div'),
            parent: null,
            prev: null,
            next: null,
            firstChild: null,
            lastChild: null,
          }),
        } as RefSpec<HTMLElement>;
      };

      const childRoute = router.route(':id', childConnected)();
      const parentRoute = router.route(
        '/products',
        parentConnected
      )(childRoute);

      expect(parentRoute).toBeDefined();
      expect(childParams).toEqual({ id: '123' });
    });
  });

  describe('connect method', () => {
    // Helper to create a mock RefSpec
    const createMockRefSpec = () =>
      ({
        status: STATUS_REF_SPEC,
        create: () => ({
          status: 1,
          element: document.createElement('div'),
          parent: null,
          prev: null,
          next: null,
          firstChild: null,
          lastChild: null,
        }),
      }) as RefSpec<HTMLElement>;

    it('should return a function that accepts user props', () => {
      const router = createRouter(mockViewApi);

      const wrapper = (): ((_userProps: {
        theme: string;
      }) => RefSpec<HTMLElement>) => {
        return () => createMockRefSpec();
      };

      const connectedFactory = router.connect(wrapper);
      expect(typeof connectedFactory).toBe('function');
    });

    it('should return a ConnectedComponent when called with user props', () => {
      const router = createRouter(mockViewApi);

      const wrapper = (): ((_userProps: {
        theme: string;
      }) => RefSpec<HTMLElement>) => {
        return () => createMockRefSpec();
      };

      const connectedFactory = router.connect(wrapper);
      const connected = connectedFactory({ theme: 'dark' });

      expect(typeof connected).toBe('function');
    });

    it('should provide route context to wrapper function', () => {
      const router = createRouter(mockViewApi);
      let capturedRouteContext: RouteContext<DOMAdapterConfig> | null = null;

      const wrapper = (
        routeContext: RouteContext<DOMAdapterConfig>
      ): (() => RefSpec<HTMLElement>) => {
        capturedRouteContext = routeContext;
        return () => createMockRefSpec();
      };

      const connectedFactory = router.connect(wrapper);
      const connected = connectedFactory({});

      const mockParams = createMockComputed(() => ({ id: '123' }));
      const routeContext: RouteContext<DOMAdapterConfig> = {
        children: null,
        params: mockParams,
      };

      connected(routeContext);

      // TypeScript assertion - we know this will be set after instantiate
      expect(capturedRouteContext).not.toBeNull();
      const context =
        capturedRouteContext as unknown as RouteContext<DOMAdapterConfig>;
      expect(context).toHaveProperty('children', null);
      expect(context).toHaveProperty('params');
      expect(context.params()).toEqual({ id: '123' });
    });

    it('should pass user props to component factory', () => {
      const router = createRouter(mockViewApi);
      let capturedUserProps: Record<string, unknown> | null = null;

      const wrapper = (): ((
        userProps: Record<string, unknown>
      ) => RefSpec<HTMLElement>) => {
        return (userProps: Record<string, unknown>) => {
          capturedUserProps = userProps;
          return createMockRefSpec();
        };
      };

      const connectedFactory = router.connect(wrapper);
      const connected = connectedFactory({ theme: 'dark', title: 'App' });

      const mockParams = createMockComputed(() => ({}));
      connected({ children: null, params: mockParams });

      expect(capturedUserProps).toEqual({ theme: 'dark', title: 'App' });
    });

    it('should return RefSpec from instantiate', () => {
      const router = createRouter(mockViewApi);

      const mockRefSpec = createMockRefSpec();

      const wrapper = (): (() => RefSpec<HTMLElement>) => {
        return () => mockRefSpec;
      };

      const connectedFactory = router.connect(wrapper);
      const connected = connectedFactory({});
      const mockParams = createMockComputed(() => ({}));
      const result = connected({ children: null, params: mockParams });

      expect(result).toBe(mockRefSpec);
    });

    it('should work with create() pattern integration', () => {
      const router = createRouter(mockViewApi);

      // Simulate the create() pattern from the requirements
      const wrapper = (
        routeContext: RouteContext<DOMAdapterConfig>
      ): ((userProps: {
        theme: string;
        title: string;
      }) => RefSpec<HTMLElement>) => {
        // Acknowledge routeContext for type checking (void ensures it's "used")
        void routeContext.children;
        return (userProps: { theme: string; title: string }) =>
          ({
            status: STATUS_REF_SPEC,
            create: () => {
              // In real usage, this would construct the component using el()
              const div = document.createElement('div');
              div.className = userProps.theme;
              div.textContent = `${userProps.title} - ${router.currentPath()}`;
              return {
                status: 1,
                element: div,
                parent: null,
                prev: null,
                next: null,
                firstChild: null,
                lastChild: null,
              };
            },
          }) as RefSpec<HTMLElement>;
      };

      const connectedFactory = router.connect(wrapper);
      const AppLayout = connectedFactory({ theme: 'dark', title: 'My App' });

      expect(typeof AppLayout).toBe('function');

      const mockParams = createMockComputed(() => ({ id: '1' }));
      const sealedSpec = AppLayout({ children: null, params: mockParams });
      expect(sealedSpec.status).toBe(STATUS_REF_SPEC);
      expect(typeof sealedSpec.create).toBe('function');
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
